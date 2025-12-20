import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "amqp-contract",
  description: "Type-safe contracts for AMQP/RabbitMQ messaging with AsyncAPI generation",
  base: "/amqp-contract/",

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
          text: "Introduction",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Core Concepts", link: "/guide/core-concepts" },
            { text: "Installation", link: "/guide/installation" },
          ],
        },
        {
          text: "Usage",
          items: [
            { text: "Defining Contracts", link: "/guide/defining-contracts" },
            { text: "Client Usage", link: "/guide/client-usage" },
            { text: "Worker Usage", link: "/guide/worker-usage" },
          ],
        },
        {
          text: "Advanced",
          items: [{ text: "AsyncAPI Generation", link: "/guide/asyncapi-generation" }],
        },
      ],
      "/api/": [
        {
          text: "Packages",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "@amqp-contract/contract", link: "/api/contract" },
            { text: "@amqp-contract/client", link: "/api/client" },
            { text: "@amqp-contract/worker", link: "/api/worker" },
            { text: "@amqp-contract/asyncapi", link: "/api/asyncapi" },
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
              text: "Introducing amqp-contract",
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

  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/amqp-contract/logo.svg" }]],
});
