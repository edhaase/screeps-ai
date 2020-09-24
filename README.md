ScreepsAI
===

> A cooperative scheduling OS for screeps through the abuse of coroutines.

## Features
 * Coroutines as "threads"
 * Tick spanning. As long we yield back to the kernel regulary, a task can take as long as it wants
 * Lifecycle callbacks
 * Memory pager via segments. Allows us to "page out" data that isn't needed immediately, reclaiming heap
 * Cron process
 * Console commands
 * Profiling (WIP)

## Console commands
 * `help()` - show registered commands
 * `init()` - recreate process table
 * `start(name,opts)` - manually start a process
 * `kill(pid)` - kill a process
 * `cron(add|rem|list,[name|num],[clock],[opts])` - add or remove scheduled code (order by next run)  (WIP)
 * `ps()` - show process table
 * `threads()` - show running threads

## Thread model

This OS uses coroutines as threads, with every process having at least one to stay running. Coroutines are implemented
via generators and are transient, lost on runtime reset. It's up to the process and it's `onReload` method to restart
any neccesary threads. 

The kernel itself schedules only threads, and each coroutine yields control back to the kernel when it's done, along with any
pending work.

## Handling yields
```
yield false | undefined; # paused until next tick
yield true;		 # run again this tick if we have enough cpu
yield promise;	 # put thread in pending state until promise completes, deliver on next pass
yield future;	 # similar to yielding a thread, but may resolve within the same tick
```

## Segment usage
 * Process table (Roughly ~800 process limit, without compression or page spanning)
 * Cron - Schedule table, ordered by next to run (For frequent tasks suggest a daemon)
 * Stats (avg cpu) - Write-only, Load for read on demand
 * Build templates (optional compression or spanning)

## Development

`npm run build` or `npm run push:local`

## Publish to MMO

`npm run push:mmo`