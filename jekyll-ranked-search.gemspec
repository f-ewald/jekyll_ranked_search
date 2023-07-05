Gem::Specification.new do |s|
  s.name        = "jekyll_ranked_search"
  s.version     = "0.0.4"
  s.summary     = "TF-IDF offline search for Jekyll posts"
  s.description = "Offline search plugin for Jekyll posts using TF-IDF"
  s.authors     = ["Friedrich Ewald"]
  s.email       = "freddiemailster@gmail.com"
  s.files       = [
    "lib/stopwords.txt",
    "lib/search.json",
    "lib/search.js",
    "lib/jekyll_ranked_search.rb"
  ]
  s.homepage    =
    "https://github.com/f-ewald/jekyll_ranked_search"
  s.license       = "MIT"
  s.add_runtime_dependency "redcarpet", "~> 3.6"
  s.required_ruby_version = ">= 2.5.0"
end