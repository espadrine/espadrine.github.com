# Two PostgreSQL Sequence Misconceptions

✨ *With Examples!* ✨

Some constructs seem more powerful than the promises they make.

PostgreSQL sequences are like that. Many assume it offers stronger properties
than it can deliver.

They trust them to be the grail of SQL ordering, the one-size-fits-all of strict
serializability. However, there is a good reason Amazon spent design time on
vector clocks in [Dynamo][], Google invested significantly into [Chubby][], then
[Percolator][]’s timestamp oracle, then [Spanner][]’s expensive,
atomic-clock-based TrueTime; why Twitter built [Snowflake][], and so many others
built custom timestamp systems.

[Dynamo]: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
[Chubby]: https://static.googleusercontent.com/media/research.google.com/en//archive/chubby-osdi06.pdf
[Percolator]: https://storage.googleapis.com/pub-tools-public-publication-data/pdf/36726.pdf
[Spanner]: https://static.googleusercontent.com/media/research.google.com/en//archive/spanner-osdi2012.pdf
[Snowflake]: https://developer.twitter.com/en/docs/basics/twitter-ids.html

1. Strict serializability is hard to achieve, especially in a distributed
   system, but even in a centralized system with the possibility of failure.
2. Developers assume the system is strict-serializable, but it usually is not.
3. When a system provides timestamps, developers will use those as if they were
   monotonically strictly increasing atomically throughout the distributed
   system, but they often are not, which causes subtle bugs.

## The problem space

To design your system’s properties right, it is often useful or necessary to
determine the order in which events happened. Ideally, you wish for the **“wall
clock” order** (looking at your watch), although instantaneity gets tricky when
events occur at a distance, even within the same motherboard, but especially
across a datacenter, or between cities.

At the very least, you want to reason about **causal ordering**: when that event
happened, did it already see this other event?

A nice property to have, even for a single centralized database, is to give a
monotonically increasing identifier for each row. Most PostgreSQL users rely on
the `SERIAL` type for that – a sequence. Each insertion will call `nextval()`
and store an increasing value.

What you implicitly want is to list rows by insertion order, Your mental model
is that each insertion happens at a set “wall clock” time. A first insertion
will happen at T0 and set the identifier 1, the next one happens at T1 and get
number 2, and so on. Therefore, _you expect a row with ID N to have causally
been inserted after a row with ID M < N_.

Operational order is a consistency constraint strongly associated with isolation
levels. A PostgreSQL database can handle multiple simultaneous operations.

_(Side note: I could be talking about threads and locks, but I will not, because
those are just tools to achieve properties. PostgreSQL may switch tools to
better meet a given promise (they did so with the serializable level in 2011),
but the promise won’t change.)_

By default, it promises **Read Committed** isolation: a transaction can witness
the effects of all transactions that commit “before” it does (but not those that
have not committed yet). Their commits are therefore causally ordered by commit
time.

However, nothing else within a transaction has any causal promise with respect
to other transactions. The same `SELECT` can yield different values;
simultaneous insertions can happen either before, after, or anything in between,
your own insertion.

The highest isolation level PostgreSQL offers is **Serializable** isolation: all
transactions are causally ordered; from `BEGIN` to `COMMIT`. Of course,
transactions still execute in parallel; but the database makes sure that
everything that a transaction witnesses can be explained by executing all its
statements either after all statements of another transaction, or before all of
them. It won’t see a changing state within the execution of the transaction.

_(By the way, PostgreSQL only achieved serializability in 2011, when they
released [version 9.1][] with support for predicate locks. It is hard.)_

[version 9.1]: https://www.postgresql.org/docs/release/9.1.0/

Having a causal order does not mean that this order follows _real time_: one
insertion may complete at 9:30am _after (in causal order)_ another that
completes later at 10:40am. If you want the additional property that the order
is consistent with wall clock time, you want **[Strict Serializability][]**.

[Strict Serializability]: https://jepsen.io/consistency/models/strict-serializable

However, **PostgreSQL makes no claim of Strict Serializability**.

Given all this, sequences probably feel much weaker than you initially thought.

You want them to give a continuous set of numbers, but a sequence can yield
values with gaps (1 2 4).

You want them to give a causal order _(2 was inserted before 3)_, but it can
yield values out of order (1 3 2).

All a sequence promises is to give values that have an order. Not a continuous
order, nor a time order.

Let’s demonstrate both.

## Gaps

Let’s create a table with a `SERIAL` identifier. For the purpose of showing
things going right, let’s insert a row.

```sql
CREATE TABLE orders (id SERIAL);
INSERT INTO orders DEFAULT VALUES;
SELECT * FROM orders;
```

     id 
    ----
      1
    (1 row)

Now comes the gap.

```sql
BEGIN;
INSERT INTO orders DEFAULT VALUES;
ROLLBACK;
```

Since we rolled back, nothing happened – or did it?

Let’s now insert another row.

```sql
INSERT INTO orders DEFAULT VALUES;
SELECT * FROM orders;
```

     id 
    ----
      1
      3
    (2 rows)

Oops! Despite the rollback, the sequence was incremented without being reverted.
Now, there is a gap.

This is not a PostgreSQL bug per se: the way sequences are stored, it just does
not keep the information necessary to undo the `nextval()` without potentially
breaking other operations.

Let’s now break the other assumption.

## Order violation

First, a table with a sequence and a timestamp:

```sql
CREATE TABLE orders (id SERIAL, created_at TIMESTAMPTZ);
```

Let’s set up two concurrent connections to the database. Each will have the same
instructions. I started the first one yesterday:

```sql
-- Connection 1
BEGIN;
```

I launch the second one today:

```sql
-- Connection 2
BEGIN;
INSERT INTO orders (created_at) VALUES (NOW());
COMMIT;
```

Let’s go back to the first one:

```sql
-- Connection 1
INSERT INTO orders (created_at) VALUES (NOW());
COMMIT;
```

Simple enough. But we actually just got the order violation:

```sql
SELECT * FROM orders ORDER BY created_at;
```

     id |          created_at           
    ----+-------------------------------
      2 | 2019-09-04 21:10:38.392352+02
      1 | 2019-09-05 08:19:34.423947+02

The order of the sequence does not follow creation order.

From then on, developers may write some queries ordering by ID, and some
ordering by timestamp, expecting an identical order. That incorrect assumption
may break their business logic.

Lest you turn your heart to another false god, that behavior remains the same
with serializable transactions.

## Are we doomed?

No.

Sure, the systems we use have weak assumptions. But that is true at every level.
The nice thing about the world is that you can combine weak things to make
strong things. Pure iron is ductile, and carbon is brittle, but their alloy is
steel.

For instance, you can get the best of both worlds, causal order and “wall clock”
timestamps, by having a `TIMESTAMPTZ` field, only inserting rows within
serializable transactions, and setting the `created_at` field to now, or after
the latest insertion:

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
INSERT INTO orders (created_at)
SELECT GREATEST(NOW(), MAX(created_at) + INTERVAL '1 microsecond') FROM orders;
COMMIT;
```

Indeed, PostgreSQL’s `TIMESTAMPTZ` has a precision up to the microsecond. You
don’t want to have conflicts in your `created_at` (otherwise you could not
determine causal order between the conflicting rows), so you add a microsecond
to the current time if there is a conflict.

However, here, concurrent operations are likely to fail, as we acquire a
(non-blocking) SIReadLock on the whole table (what the documentation calls a
relation lock):

```sql
SELECT l.mode, l.relation::regclass, l.page, l.tuple, substring(a.query from 0 for 19)
FROM pg_stat_activity a JOIN pg_locks l ON l.pid = a.pid
WHERE l.relation::regclass::text LIKE 'orders%'
  AND datname = current_database()
  AND granted
ORDER BY a.query_start;
```

           mode       | relation | page | tuple |     substring
    ------------------+----------+------+-------+--------------------
     SIReadLock       | orders   |      |       | INSERT INTO orders
     RowExclusiveLock | orders   |      |       | INSERT INTO orders
     AccessShareLock  | orders   |      |       | INSERT INTO orders

The reason for that is that we perform a slow Seq Scan in this trivial example,
as the [EXPLAIN][] proves.

                                      QUERY PLAN
    -------------------------------------------------------------------------------
     Insert on orders  (cost=38.25..38.28 rows=1 width=8)
       ->  Aggregate  (cost=38.25..38.27 rows=1 width=8)
             ->  Seq Scan on orders orders_1  (cost=0.00..32.60 rows=2260 width=8)

[EXPLAIN]: https://www.postgresql.org/docs/current/using-explain.html

With an [index][], concurrent operations are much more likely to work:

[index]: https://www.postgresql.org/docs/current/sql-createindex.html

```sql
CREATE INDEX created_at_idx ON orders (created_at);
```

We then only take a tuple lock on the table:

           mode       | relation | page | tuple |     substring      
    ------------------+----------+------+-------+--------------------
     SIReadLock       | orders   |    0 |     5 | INSERT INTO orders
     RowExclusiveLock | orders   |      |       | INSERT INTO orders
     AccessShareLock  | orders   |      |       | INSERT INTO orders

However, the tuple in question is the latest row in the table. Any two
concurrent insertions will definitely read from the same one: the one with the
latest `created_at`. Therefore, only one of concurrent insertion will succeed;
the others will need to be retried until they do too.

## Subset Ordering

In cases where you only need a unique ordering for a subset of rows based on
another field, you can set a combined index with that other field:

```sql
CREATE TABLE orders (
  account_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ);
CREATE INDEX account_created_at_idx ON orders (account_id, created_at DESC);
```

Then the [query planner][EXPLAIN] goes through the account index:

```sql
INSERT INTO orders (account_id, created_at)
SELECT account_id, GREATEST(NOW(), created_at + INTERVAL '1 microsecond')
FROM orders WHERE account_id = '9c99bef6-a05a-48c4-bba3-6080a6ce4f2e'::uuid
ORDER BY created_at DESC LIMIT 1
```

                                                          QUERY PLAN
    -----------------------------------------------------------------------------------------------------------------------
     Insert on orders  (cost=0.15..3.69 rows=1 width=24)
       ->  Subquery Scan on "*SELECT*"  (cost=0.15..3.69 rows=1 width=24)
             ->  Limit  (cost=0.15..3.68 rows=1 width=32)
                   ->  Index Only Scan using account_created_at_idx on orders orders_1  (cost=0.15..28.35 rows=8 width=32)
                         Index Cond: (account_id = '9c99bef6-a05a-48c4-bba3-6080a6ce4f2e'::uuid)

And concurrent insertions on different accounts work:

           mode       | relation | page | tuple |     substring
    ------------------+----------+------+-------+--------------------
     SIReadLock       | orders   |    0 |     1 | INSERT INTO orders
     RowExclusiveLock | orders   |      |       | INSERT INTO orders
     AccessShareLock  | orders   |      |       | INSERT INTO orders
     SIReadLock       | orders   |    0 |     2 | COMMIT;

(The first three row are from one not-finished transaction on account 1, the
last is from a finished one on account 2.)

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2019-09-05T17:28:59Z",
  "keywords": "sql" }
</script>
