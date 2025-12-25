# ADR-001: Client and Worker Terminology

**Status**: Accepted  
**Date**: 2025-12-25  
**Deciders**: Project Maintainers

## Context

The AMQP and RabbitMQ ecosystem typically uses the terms "publisher" and "consumer" to describe applications that send and receive messages, respectively. However, for this project, we needed to choose terminology that would:

1. Be clear and intuitive for developers from various backgrounds
2. Convey the intent and behavior of each component
3. Work well as TypeScript class names
4. Avoid ambiguity in different contexts

The key question: Should we use the standard AMQP terms (publisher/consumer) or alternative terms (client/worker)?

## Decision

We have decided to use **"client"** and **"worker"** terminology for the runtime components:

- **TypedAmqpClient** - For publishing messages
- **TypedAmqpWorker** - For consuming and processing messages

However, within **contract definitions**, we continue to use standard terms:

- `publishers: { ... }` - Publishing endpoints in the contract
- `consumers: { ... }` - Consuming endpoints in the contract

## Rationale

### Why "Client" instead of "Publisher"?

1. **Clarity**: "Client" is universally understood as the component that initiates communication
2. **Familiarity**: Developers from HTTP/REST backgrounds easily understand "client"
3. **Conciseness**: `TypedAmqpClient` is shorter and clearer than `TypedAmqpPublisher`
4. **Intent**: Emphasizes the role as the initiator of message sending

### Why "Worker" instead of "Consumer"?

1. **Specificity**: "Worker" conveys active processing behavior, not just passive consumption
2. **Familiarity**: Widely used in job queue systems (Bull, BullMQ, Sidekiq, Celery)
3. **Clarity**: Avoids ambiguity with business-level "consumers" (users of a service)
4. **Intent**: Emphasizes background processing and task execution

### Why Keep "publishers" and "consumers" in Contracts?

1. **Alignment**: Contract definitions should use standard AMQP terminology
2. **Documentation**: Makes it easier to map contracts to AMQP concepts
3. **Clarity**: Distinguishes contract-level definitions from runtime components
4. **Standards**: Follows AsyncAPI and AMQP specifications

## Consequences

### Positive

1. **Clear Developer Experience**: The role of each component is immediately obvious
2. **Intuitive API**: Class names and methods are self-documenting
3. **Cross-Domain Appeal**: Familiar to developers from various backgrounds
4. **Reduced Ambiguity**: "Worker" is more specific than "consumer"

### Negative

1. **Divergence from AMQP Standard**: May initially confuse AMQP veterans
2. **Documentation Burden**: Need to explain the mapping to standard terms
3. **Ecosystem Consistency**: Other AMQP libraries use different terms
4. **Migration Consideration**: Would require breaking change to switch to standard terms

### Mitigation

To address the divergence from AMQP standards, we will:

1. **Document the Mapping**: Create clear documentation explaining the terminology choice
2. **Provide Translation Guide**: Help AMQP veterans understand the mapping
3. **Consider Aliases**: May add type aliases in the future for flexibility
4. **Gather Feedback**: Monitor community response and adjust if needed

## Alternatives Considered

### Alternative 1: Use Standard AMQP Terms (Publisher/Consumer)

**Classes:**

- `TypedAmqpPublisher`
- `TypedAmqpConsumer`

**Pros:**

- Aligns with AMQP/RabbitMQ documentation
- Consistent with other AMQP libraries
- No explanation needed for AMQP veterans

**Cons:**

- `TypedAmqpConsumer` is longer and less intuitive
- "Consumer" is ambiguous (technical vs. business meaning)
- Less familiar to developers from other domains
- "Publisher" feels more technical than necessary

**Why not chosen:** While technically correct, these terms are less intuitive and "consumer" is particularly ambiguous.

### Alternative 2: Use Producer/Consumer

**Classes:**

- `TypedAmqpProducer`
- `TypedAmqpConsumer`

**Pros:**

- Common in messaging systems (Kafka uses this)
- Shorter than "publisher"

**Cons:**

- Still has the "consumer" ambiguity issue
- "Producer" less familiar than "client"
- Not as clear as "client/worker"

**Why not chosen:** Doesn't significantly improve over publisher/consumer, and "producer" is less intuitive than "client."

### Alternative 3: Use Sender/Receiver

**Classes:**

- `TypedAmqpSender`
- `TypedAmqpReceiver`

**Pros:**

- Very simple and clear
- No domain-specific terminology

**Cons:**

- Too generic, doesn't convey processing intent
- "Receiver" implies passive listening only
- Loses the semantic meaning of message processing

**Why not chosen:** Too generic and doesn't convey the active processing behavior we want to emphasize.

## Future Considerations

### Potential Evolution

We may revisit this decision for a major version (v1.0 or v2.0) if:

1. **Community Feedback**: Strong preference for standard terms emerges
2. **Ecosystem Evolution**: TypeScript/Node.js AMQP ecosystem converges on standard terms
3. **Confusion Reports**: Frequent confusion from users about terminology

### Migration Path

If we decide to change terminology in the future:

1. **Phase 1**: Add type aliases

   ```typescript
   export { TypedAmqpClient as TypedAmqpPublisher };
   export { TypedAmqpWorker as TypedAmqpConsumer };
   ```

2. **Phase 2**: Deprecate old names with warnings

   ```typescript
   /** @deprecated Use TypedAmqpPublisher instead */
   export const TypedAmqpClient = TypedAmqpPublisher;
   ```

3. **Phase 3**: Remove old names in next major version

## References

- [RabbitMQ Tutorial - Publishers and Consumers](https://www.rabbitmq.com/tutorials/tutorial-one-javascript.html)
- [AMQP 0-9-1 Model Explained](https://www.rabbitmq.com/tutorials/amqp-concepts.html)
- [Bull Queue - Worker Terminology](https://docs.bullmq.io/guide/workers)
- [TERMINOLOGY.md](../../TERMINOLOGY.md) - Project terminology guide

## Related ADRs

- [ADR-002: Separate Client and Worker Packages](./002-separate-packages.md)
