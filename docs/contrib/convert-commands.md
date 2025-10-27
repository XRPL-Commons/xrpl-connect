# Convert commands list

I use these command line scripts for preparing miniatures and process the website images.

## Create a thumbnail from a PDF's first page

From the main Jekyll folder do:

``` bash
convert -density 300 -resize %10 \
        -background white -alpha remove -bordercolor black -border 1 \
        download/cv_en.pdf[0] images/cv_en.png
```

## Add a black border to all the images in the folder.

This is particularly useful for my slideshows (with white backgrounds):

```bash
convert -background white -alpha remove -bordercolor black -border 1 *.png
```

Using these parameters with mogrify will replace the original images (be cautious!!).
