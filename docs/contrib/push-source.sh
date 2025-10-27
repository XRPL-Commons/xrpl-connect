#!/bin/bash

git add -A
read -p "Commit message: " -e MESSAGE
git commit -m "$MESSAGE"
git push origin main
