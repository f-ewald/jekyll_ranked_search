# frozen_string_literal: true

require_relative "test_helper"
require "json"
require "tmpdir"

class JekyllRankedSearchTest < Minitest::Test
  LONG_TEXT = (1..50).map { |i| "word#{i}" }.join(" ")

  POSTS = {
    "2023-01-01-old.md" => "Learn [docker](https://example.com/secret) containers containers.\n",
    "2023-03-01-empty.md" => "",
    "2023-06-01-new.md" => "Ruby and docker.\n\n#{LONG_TEXT}\n",
  }.freeze

  def setup
    @converter = TfidfConverter.new
  end

  def build_site
    Dir.mktmpdir do |dir|
      FileUtils.mkdir_p(File.join(dir, "_posts"))
      POSTS.each_with_index do |(name, body), i|
        File.write(File.join(dir, "_posts", name), "---\ntitle: Post #{i}\n---\n#{body}")
      end
      config = Jekyll.configuration(
        "source" => dir, "destination" => File.join(dir, "_site"), "quiet" => true
      )
      Jekyll::Site.new(config).process
      yield File.join(dir, "_site")
    end
  end

  def test_site_build_generates_index_and_script
    build_site do |out|
      assert File.exist?(File.join(out, "js", "search.js"))
      index = JSON.parse(File.read(File.join(out, "search.json")))
      bow, docs, tfidf = index.values_at("bow", "docs", "tfidf")

      assert_equal ["Post 0", "Post 1", "Post 2"], docs.map { |d| d["title"] }
      refute_includes docs[0]["text"], "example.com", "links must be stripped"
      refute docs[0]["text"].end_with?("..."), "short posts must not be truncated"
      assert_equal "", docs[1]["text"]
      assert docs[2]["text"].end_with?("..."), "long posts must be truncated"

      refute_includes bow, "", "empty tokens must not be indexed"
      refute_includes bow, "and", "stopwords must not be indexed"
      assert_equal [0, 2], index["word2doc"][bow["docker"].to_s]

      assert_equal Math.log(3.0 / 2).round(4), tfidf["#{bow["docker"]},0"]
      # Repeated term counts once toward document frequency: 2 * ln(3) * boost(oldest = 1.0)
      assert_equal (2 * Math.log(3)).round(4), tfidf["#{bow["containers"]},0"]
      # Newest document gets the full 20% boost
      assert_equal (Math.log(3) * 1.2).round(4), tfidf["#{bow["ruby"]},2"]
    end
  end

  def test_calculate_tfidf_single_document
    assert_equal({ "0,0" => 0.0 }, @converter.calculate_tfidf({ "0,0" => 3 }, { 0 => 1 }, 1))
  end

  def test_tokenize_words
    [
      ["Docker, Ruby!", %w[docker ruby]],
      ["foo – bar", %w[foo bar]],
      ["The cat", %w[cat]],
      ["   ", []],
    ].each do |input, expected|
      assert_equal expected, @converter.tokenize_words(input), "input: #{input.inspect}"
    end
  end
end
