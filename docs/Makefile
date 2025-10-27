include contrib/*.mk

.PHONY: 1-new-draft
## Create a new draft in the _drafts folder
1-new-draft:
	@bash contrib/new-draft.sh


.PHONY: 2-start-server
## Start a Jekyll server at port 4000
2-start-server:
	@docker compose -f contrib/jekyll-serve.yml up 
	@sleep 15s
	@sensible-browser http://0.0.0.0:4000/


.PHONY: 3-stop-server
## Close the jekyll server
3-stop-server:
	@docker compose -f contrib/jekyll-serve.yml down
	@sudo rm -rf _site Gemfile.lock

.PHONY: 4-push-source
## Push to source branch
4-push-source:
	@bash contrib/push-source.sh

.PHONY: 5-deploy-website
## Deploy to master branch (ghpage)
5-deploy-website:
	@bash contrib/deploy-website.sh


standarize-images:
	@rename 'y/A-Z/a-z/' images/*
	@rename 'y/\_/-/' images/*
