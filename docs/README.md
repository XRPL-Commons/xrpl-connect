# Jekyll GitBook Template

A ready-to-use template for creating a GitBook-style website using [Jekyll](https://jekyllrb.com/), the [jekyll-gitbook](https://github.com/sighingnow/jekyll-gitbook) theme, and [jekyll-scholar](https://github.com/inukshuk/jekyll-scholar) for managing academic references.

## Table of Contents

- [Features](#features)
- [Setup](#setup)
- [How to Use](#how-to-use)
- [Customization](#customization)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Features

- **GitBook-style layout:** Clean and responsive design that mimics GitBook.
- **Jekyll Scholar integration:** Seamlessly manage and display academic references.
- **Easy setup:** Simple installation process with clear instructions.
- **Customization:** Easily tweak the design and functionality to suit your needs.
- **Markdown support:** Write your content in Markdown.

## Setup

### Prerequisites

To get started, make sure you have the following installed:

- [Ruby](https://www.ruby-lang.org/en/downloads/) (version 2.5.0 or higher)
- [Bundler](https://bundler.io/)
- [Jekyll](https://jekyllrb.com/)

### Installation

1. **Clone this repository:**
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```
2. **Install the dependencies:**
   ```bash
   bundle install
   ```
4. **Run the Jekyll server:**
   ```bash
   bundle exec jekyll serve
   ```
5. **Visit your site:**
Open your web browser and navigate to `http://localhost:4000`.

# How to Use
## Adding Content

- **Markdown files:** Add your content in the `_posts` directory for blog-style posts or directly into specific folders for chapters or sections.
- **Bibliography:** Manage your references by editing the `references.bib` file located in the root directory. You can then cite them in your markdown files using the `jekyll-scholar` syntax.

## Building the Site

When you are ready to deploy your site, you can build it using:
```bash
bundle exec jekyll build
```
The generated static files will be placed in the `_site` directory, ready to be hosted on GitHub Pages or any other static site hosting platform.
Customizing the Theme

You can customize the theme by modifying the `_config.yml` file and the styles in the `assets/css` directory.

- **Config options:** Change site-wide settings such as title, description, and navigation in `_config.yml`.
- **Layout and styles:** Tweak the layout in _layouts and `_includes`, and update styles in `assets/css/style.css`.

# Contributing

Feel free to open issues or submit pull requests if you have suggestions for improvements or new features.

# License

This project is licensed under the MIT License. See the LICENSE file for more details.

# Acknowledgements

This template is built with:

- [jekyll-gitbook](https://github.com/sighingnow/jekyll-gitbook) by [Sighingnow](https://github.com/sighingnow)
- [jekyll-scholar](https://github.com/inukshuk/jekyll-scholar) by [Inukshuk](https://github.com/inukshuk)

Check out their projects for more detailed documentation and updates.


