import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    title: "amqp-contract",
    description: "Type-safe contracts for AMQP/RabbitMQ messaging with AsyncAPI generation",
    base: "/amqp-contract/",
    lang: "en-US",

    sitemap: {
      hostname: "https://btravers.github.io/amqp-contract/",
    },

    // Inject canonical URLs and dynamic meta tags for each page to prevent duplicate content issues
    transformPageData(pageData) {
      // Only process markdown files
      if (!pageData.relativePath.endsWith(".md")) {
        return;
      }

      // VitePress provides relativePath without leading slash (e.g., "guide/getting-started.md")
      // Normalize the path by removing any leading slashes just in case
      const normalizedPath = pageData.relativePath.replace(/^\/+/, "");
      const canonicalUrl = `https://btravers.github.io/amqp-contract/${normalizedPath}`
        .replace(/index\.md$/, "")
        .replace(/\.md$/, ".html");

      // Ensure frontmatter and head array exist
      pageData.frontmatter ??= {};
      pageData.frontmatter.head ??= [];

      // Add canonical URL
      pageData.frontmatter.head.push(["link", { rel: "canonical", href: canonicalUrl }]);

      // Add dynamic Open Graph tags
      const pageTitle = pageData.title || pageData.frontmatter.title || "amqp-contract";
      const pageDescription =
        pageData.description ||
        pageData.frontmatter.description ||
        "Type-safe contracts for AMQP/RabbitMQ messaging with AsyncAPI generation";

      pageData.frontmatter.head.push(
        ["meta", { property: "og:url", content: canonicalUrl }],
        ["meta", { property: "og:title", content: pageTitle }],
        ["meta", { property: "og:description", content: pageDescription }],
      );

      // Add dynamic Twitter Card tags
      pageData.frontmatter.head.push(
        ["meta", { name: "twitter:title", content: pageTitle }],
        ["meta", { name: "twitter:description", content: pageDescription }],
      );
    },

    // Mermaid configuration
    mermaidPlugin: {
      class: "mermaid",
    },

    themeConfig: {
      // https://vitepress.dev/reference/default-theme-config
      logo: "/logo.svg",

      nav: [
        { text: "Home", link: "/" },
        { text: "Guide", link: "/guide/getting-started" },
        { text: "API", link: "/api/" },
        { text: "Examples", link: "/examples/" },
        { text: "Blog", link: "/blog/" },
      ],

      sidebar: {
        "/guide/": [
          {
            text: "Getting Started",
            items: [
              { text: "Getting Started", link: "/guide/getting-started" },
              { text: "Core Concepts", link: "/guide/core-concepts" },
            ],
          },
          {
            text: "Core Usage",
            items: [
              { text: "Defining Contracts", link: "/guide/defining-contracts" },
              { text: "Client Usage", link: "/guide/client-usage" },
              { text: "Worker Usage", link: "/guide/worker-usage" },
              { text: "Testing", link: "/guide/testing" },
            ],
          },
          {
            text: "NestJS",
            items: [
              { text: "Client", link: "/guide/client-nestjs-usage" },
              { text: "Worker", link: "/guide/worker-nestjs-usage" },
            ],
          },
          {
            text: "Advanced",
            items: [{ text: "AsyncAPI Generation", link: "/guide/asyncapi-generation" }],
          },
        ],
        "/api/": [
          {
            text: "Core Packages",
            items: [
              { text: "Overview", link: "/api/" },
              { text: "@amqp-contract/contract", link: "/api/contract/" },
              { text: "@amqp-contract/client", link: "/api/client/" },
              { text: "@amqp-contract/worker", link: "/api/worker/" },
              { text: "@amqp-contract/asyncapi", link: "/api/asyncapi/" },
            ],
          },
          {
            text: "NestJS Integration",
            items: [
              { text: "@amqp-contract/client-nestjs", link: "/api/client-nestjs/" },
              { text: "@amqp-contract/worker-nestjs", link: "/api/worker-nestjs/" },
            ],
          },
          {
            text: "Testing",
            items: [
              { text: "@amqp-contract/testing", link: "/api/testing/" },
            ],
          },
        ],
        "/examples/": [
          {
            text: "Examples",
            items: [
              { text: "Overview", link: "/examples/" },
              {
                text: "Basic Order Processing",
                link: "/examples/basic-order-processing",
              },
              {
                text: "AsyncAPI Generation",
                link: "/examples/asyncapi-generation",
              },
            ],
          },
        ],
        "/blog/": [
          {
            text: "Blog",
            items: [
              { text: "Overview", link: "/blog/" },
              {
                text: "Building Type-Safe AMQP Messaging",
                link: "/blog/introducing-amqp-contract",
              },
            ],
          },
        ],
      },

      socialLinks: [
        { icon: "github", link: "https://github.com/btravers/amqp-contract" },
        {
          icon: "npm",
          link: "https://www.npmjs.com/package/@amqp-contract/contract",
        },
      ],

      footer: {
        message: "Released under the MIT License.",
        copyright: `Copyright © ${new Date().getFullYear()} Benoit TRAVERS`,
      },

      search: {
        provider: "local",
      },

      editLink: {
        pattern: "https://github.com/btravers/amqp-contract/edit/main/website/docs/:path",
        text: "Edit this page on GitHub",
      },
    },

    head: [
      ["link", { rel: "icon", type: "image/svg+xml", href: "/amqp-contract/logo.svg" }],
      [
        "meta",
        {
          name: "google-site-verification",
          content: "u6ZPW5bWbP9G1yF5Sv7B4fSOJm5rLbZWeH858tmisTc",
        },
      ],
      // Open Graph meta tags for better social sharing and SEO
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "amqp-contract" }],
      ["meta", { property: "og:locale", content: "en_US" }],
      [
        "meta",
        { property: "og:image", content: "https://btravers.github.io/amqp-contract/logo.svg" },
      ],
      ["meta", { property: "og:image:alt", content: "amqp-contract logo" }],
      // Twitter Card meta tags
      ["meta", { name: "twitter:card", content: "summary" }],
      [
        "meta",
        { name: "twitter:image", content: "https://btravers.github.io/amqp-contract/logo.svg" },
      ],
      ["meta", { name: "twitter:image:alt", content: "amqp-contract logo" }],
      // Additional SEO meta tags
      ["meta", { name: "author", content: "Benoit TRAVERS" }],
      ["meta", { name: "robots", content: "index, follow" }],
    ],
  }),
);
