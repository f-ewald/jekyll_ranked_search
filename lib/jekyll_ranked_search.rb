# frozen_string_literal: true

require "set"
require "redcarpet"
require "redcarpet/render_strip"


# Renderer for Redcarpet that strips all links and only returns the text.
# Inherits from StripDown renderer.
class MarkdownRenderer < Redcarpet::Render::StripDown
  def link(link, title, content)
    content
  end
end


# Jekyll plugin to generate a TF-IDF search index for posts.
class TfidfConverter < Jekyll::Generator
  def generate(site)
    Jekyll.logger.info "Jekyll Ranked Search: Generating search index"

    self.generate_index(site, site.posts.docs)
    site.pages << self.search_json(site)
    site.pages << self.search_js(site)

    Jekyll.logger.info "Jekyll Ranked Search: Done"
  end

  # Generate search index, calculate tfidf values
  def generate_index(site, docs)
    # All docs
    processed_docs = []
    # Map of word to document
    word2doc = {}
    # Bag of words, assigns word to index
    bow = {}
    # Term frequency per document in the format term_id,doc_id = freq
    # This is a sparse matrix to save disk space and memory on the receiving end
    tf = {}
    # Frequency of words in documents as sparse matrix
    df = {}
    # Total number of documents
    total_docs = docs.length

    # Markdown parser
    markdown = Redcarpet::Markdown.new(MarkdownRenderer)

    # Create vocabulary
    docs.each_with_index do |post, idx|
      content = markdown.render(post.content)

      # Tokenize content before applying any other transformations
      tokenized = self.tokenize_words "#{post.data['title']} #{content}"

      # Replace newlines with wide spaces and bullet points
      divider = " • "
      content.gsub!(/\n/, divider)

      # Remove trailing divider
      if content.end_with?(divider)
        content = content[0..-4]
      end
      
      # Take first n words of post
      n_words = 40
      splitted_content = content.split(" ")
      word_count = splitted_content.length
      content = splitted_content[..n_words].join(" ")  # The first n words of the post
      if word_count > n_words
        content += "..."
      end

      processed_docs.push({
        title: post.data['title'],
        url: post.url,
        date: post.data['date'].strftime("%FT%T%z"),
        text: content,
      })

      token_seen = false
      tokenized.each do |word|
        if !bow.include?(word)
          bow[word] = bow.length
        end

        # The key is the term_id which is calculated in the step before.
        word2doc[bow[word]] ||= Set.new
        word2doc[bow[word]] << idx
        
        tf["#{bow[word]},#{idx}"] ||= 0
        tf["#{bow[word]},#{idx}"] += 1
        if !token_seen
          df[bow[word]] ||= 0
          df[bow[word]] += 1
        end
      end
    end

    # Convert word2doc set to array
    word2doc.each_key do |key|
      word2doc[key] = word2doc[key].to_a
    end

    # Save in site data object for access in templates
    site.data['docs'] = processed_docs.to_json
    site.data['word2doc'] = word2doc.to_json
    site.data['bow'] = bow.to_json

    # Calculate tf-idf for each document in the shape term_id,doc_id = tfidf
    tfidf = {}
    tf.each do |idx, freq|
      token_idx, doc_idx = idx.split(',').map { |i| i.to_i }
      _idf = Math.log(total_docs / df[token_idx] + 0.00001)

      # Exponential decay over time (boost newer posts)
      boost = 1.2**doc_idx/(total_docs/2)

      # Calculate TF-IDF and boost newer posts by up to 20%
      tfidf[idx] = (freq * _idf * boost).round(4)
    end
    
    site.data['tfidf'] = tfidf.to_json
  end

  def tokenize_words(doc)
    # Remove stopwords from document
    @stopwords ||= self.load_stopwords

    # Split document into tokens
    splitted_doc = doc.strip.downcase.split

    # Remove stopwords in place
    splitted_doc.delete_if { |word| @stopwords.include?(word) }

    # Remove special characters (only at beginning and end)
    splitted_doc.map! { |word| word.gsub(/[^a-z0-9_\/\-\s]/i, '') }

    splitted_doc
  end

  # Load stopwords from file
  def load_stopwords
    Jekyll.logger.info "Loading stopwords"
    stopwords = Set.new
    File.open(File.join(File.dirname(__FILE__), "stopwords.txt"), "r") do |f|
      f.each_line do |line|
        stopwords.add line.strip
      end
    end
    Jekyll.logger.info "Done loading #{stopwords.length} stopwords"
    stopwords
  end

  # Create search.json from template and return as Jekyll Page object
  def search_json(site)
    template = File.read(File.join(File.dirname(__FILE__), "search.json"))
    page = Jekyll::PageWithoutAFile.new(site, __dir__, "", "search.json").tap do |p|
      p.content = template
    end
    page
  end

  # Create search.js from template and return as Jekyll Page object
  def search_js(site)
    search_js = File.read(File.join(File.dirname(__FILE__), "search.js"))
    page = Jekyll::PageWithoutAFile.new(site, __dir__, "", "js/search.js").tap do |p|
      p.content = search_js
    end
    page
  end
end
