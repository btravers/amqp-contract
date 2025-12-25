# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) for the amqp-contract project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Format

We use the following format for ADRs:

```markdown
# [Number]. [Title]

**Status**: [Proposed | Accepted | Deprecated | Superseded]
**Date**: [YYYY-MM-DD]
**Deciders**: [Names]

## Context

[Describe the issue motivating this decision and any context that influences the decision]

## Decision

[Describe the decision and its rationale]

## Consequences

[Describe the resulting context, including positive and negative consequences]

## Alternatives Considered

[Describe alternative solutions that were considered and why they were not chosen]
```

## Index

- [ADR-001: Client and Worker Terminology](./001-client-worker-terminology.md)
- [ADR-002: Separate Client and Worker Packages](./002-separate-packages.md)
- [ADR-003: Connection Sharing Strategy](./003-connection-sharing.md)

## Status Definitions

- **Proposed**: The ADR is under discussion
- **Accepted**: The ADR has been accepted and should be followed
- **Deprecated**: The ADR is no longer applicable but kept for historical reference
- **Superseded**: The ADR has been replaced by another ADR
