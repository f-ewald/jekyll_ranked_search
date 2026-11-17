# frozen_string_literal: true

require "simplecov"
SimpleCov.start do
  add_filter "/test/"
  enable_coverage :branch
  minimum_coverage line: 100, branch: 100
end

require "minitest/autorun"
require "jekyll"
require_relative "../lib/jekyll_ranked_search"

Jekyll.logger.log_level = :error
