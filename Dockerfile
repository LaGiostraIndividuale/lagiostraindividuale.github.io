FROM ruby:3.2

# Dipendenze per gemme native (es. nokogiri) + git
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /site

EXPOSE 4000
EXPOSE 35729
