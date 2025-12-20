# Blog Articles

This directory contains blog articles for the amqp-contract project.

## Articles

### Introducing amqp-contract

- **Website version**: [`website/docs/blog/introducing-amqp-contract.md`](../website/docs/blog/introducing-amqp-contract.md)
- **dev.to version**: [`introducing-amqp-contract-devto.md`](./introducing-amqp-contract-devto.md)

The introduction article that explains the project, its features, and how to get started.

**Published on website**: [https://btravers.github.io/amqp-contract/blog/introducing-amqp-contract](https://btravers.github.io/amqp-contract/blog/introducing-amqp-contract)

## Publishing to dev.to

To publish an article to dev.to:

1. Go to https://dev.to/new
2. Click on "Import a post" or use the editor
3. Copy the content from the `*-devto.md` file
4. The front matter includes:
   - `title`: Article title
   - `published`: Set to `true` when ready to publish
   - `description`: Short description
   - `tags`: Up to 4 tags (comma-separated)
   - `cover_image`: Optional cover image URL
   - `canonical_url`: Link to the article on the website
   - `series`: Optional series name

5. Review the preview
6. Adjust the `published` field in the front matter:
   - `published: false` - Save as draft
   - `published: true` - Publish immediately

7. Click "Save draft" or "Publish"

## dev.to Front Matter Format

```yaml
---
title: Your Article Title
published: false
description: Brief description of the article
tags: tag1, tag2, tag3, tag4
cover_image: https://example.com/image.png
canonical_url: https://your-site.com/article
series: series-name
---
```

## Notes

- dev.to supports markdown with some extensions
- The `{% github username/repo %}` liquid tag embeds the repository card
- Images should use absolute URLs
- Maximum 4 tags allowed
- The `canonical_url` helps with SEO by pointing to the original source
