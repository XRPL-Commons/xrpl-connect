#!/bin/bash

# A script to deploy a Jekyll _site to GH master/source
# Only use this script after commiting your changes to $SOURCE

# Use these defaults
SOURCE="source"
SITE="master"
# Get the latest commit SHA in SOURCE branch
last_SHA=( $(git log -n 1 --pretty=oneline) )

# The name of the temporary folder will be the
#   last commit SHA, to prevent possible conflicts
#   with other folder names.
tmp_dir="temp_$last_SHA"

# Make sure on the SOURCE branch
git checkout $SOURCE > /dev/null 2>&1

# Jekyll build to create _site, then down docker-compose
docker-compose -f contrib/jekyll-build.yml up > /dev/null 2>&1
if [ $? = 0 ]; then
  docker-compose -f contrib/jekyll-build.yml down
  echo "Build successful"
else
  docker-compose -f contrib/jekyll-build.yml down
  echo "Build failed"
  exit 1
fi

# Copy _site to a temporary folder
cp -r _site/ ~/$tmp_dir/ > /dev/null 2>&1
if [ $? = 0 ]; then
  echo "copy _site to $tmp_dir successful"
else
  echo "copy _site to $tmp_dir failed"
  exit 1
fi


# Delete remote and local $SITE
git push origin --delete $SITE
git branch -D $SITE

# Switch to the SITE branch
git checkout $SITE > /dev/null 2>&1
if [ $? = 1 ]; then
  # Branch does not exist. Create an orphan branch.
  git checkout -b $SITE > /dev/null 2>&1
  #git add --all .
  #git commit -m "Initial commit" > /dev/null 2>&1
  echo "$SITE branch does not exist, created new"
fi

# Remove the current contents of the SITE branch and
# replace them with the contents of the temp folder
current_dir=${PWD}
rm -r $current_dir/*
git rm -r --cached * > /dev/null 2>&1
cp -r ~/$tmp_dir/* $current_dir

# Commit the changes to the SITE branch
message="Updated $SITE site from $SOURCE ($last_SHA)"
git add --all .
git commit -m "$message" > /dev/null 2>&1

# Delete the temporary folder
rm -r ~/$tmp_dir

# Push latest SITE to github
git push -u origin $SITE > /dev/null 2>&1
if [ $? = 0 ]; then
  echo "Push $SITE successful"
else
  echo "Push $SITE failed"
fi

# Switch back to SOURCE branch
git checkout $SOURCE > /dev/null 2>&1




