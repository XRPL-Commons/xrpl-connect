#!/bin/bash

read -p "Draft title: " -e TITLE
#DTITLE=`echo -n $TITLE | sed 's/ /-/g' | sed 's/[^A-Za-z0-9-]//g' | tr "[:upper:]" "[:lower:]"`
DTITLE=`echo -n $TITLE | sed 's/ /-/g' | tr "[:upper:]" "[:lower:]"`
DATE=`date +%Y-%m-%d`
FILENAME=_drafts/$DATE-$DTITLE.md

if [ -f $FILENAME ]; then
  echo "Editing \"" $TITLE "\""
else
  echo "---" > $FILENAME
  echo "title:" $TITLE >> $FILENAME
  echo "categories: [cat1, cat2]" >> $FILENAME
  echo "tags: [tag1, tag2]" >> $FILENAME
  echo "---" >> $FILENAME
fi

#sensible-editor $FILENAME

gedit $FILENAME
