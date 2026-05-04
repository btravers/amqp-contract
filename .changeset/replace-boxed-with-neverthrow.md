---
"@amqp-contract/asyncapi": minor
"@amqp-contract/client": minor
"@amqp-contract/contract": minor
"@amqp-contract/core": minor
"@amqp-contract/testing": minor
"@amqp-contract/worker": minor
---

Replace `@swan-io/boxed` with `neverthrow` for the public Result/async API.

**Breaking.** Public method signatures change from `Future<Result<T, E>>` to `ResultAsync<T, E>`. Handlers must now return `ResultAsync<void, HandlerError>` (regular consumers) or `ResultAsync<TResponse, HandlerError>` (RPCs).

Migration cheat-sheet:

| Before (`@swan-io/boxed`)             | After (`neverthrow`)                  |
| ------------------------------------- | ------------------------------------- |
| `Future.value(Result.Ok(x))`          | `okAsync(x)`                          |
| `Future.value(Result.Error(e))`       | `errAsync(e)`                         |
| `Result.Ok(x)` / `Result.Error(e)`    | `ok(x)` / `err(e)`                    |
| `Future.fromPromise(p).mapError(fn)`  | `ResultAsync.fromPromise(p, fn)`      |
| `f.mapOk(fn)` / `f.mapError(fn)`      | `f.map(fn)` / `f.mapErr(fn)`          |
| `f.flatMapOk(fn)` / `f.flatMapError`  | `f.andThen(fn)` / `f.orElse(fn)`      |
| `f.tapOk(fn)` / `f.tapError(fn)`      | `f.andTee(fn)` / `f.orTee(fn)`        |
| `r.match({ Ok, Error })`              | `r.match(okFn, errFn)` (positional)   |
| `Future.all([...])` of Result-Futures | `ResultAsync.combine([...])`          |
| `await x.resultToPromise()` (unwrap)  | `(await x)._unsafeUnwrap()`           |
| `await x.toPromise()` (Result wrap)   | `await x` (`ResultAsync` is thenable) |
| `result.isError()`                    | `result.isErr()`                      |

`Future` semantics that are not preserved: laziness and cancellation. `ResultAsync` is eager and Promise-backed. None of the library internals depended on Future-side cancel.
