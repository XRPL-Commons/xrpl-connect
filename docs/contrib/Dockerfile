FROM ruby:3.2

WORKDIR /srv/jekyll

# Install bundler version 1.17.1
RUN gem install bundler -v 2.3.0

RUN gem install jekyll-scholar

COPY Gemfile ./
RUN bundle install

CMD [ "bundle", "exec", "jekyll", "serve" ]
