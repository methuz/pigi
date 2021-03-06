/* External Imports */
import BigNum from 'bn.js'

/* Internal Imports */
import { bnMax, bnMin } from './misc'

export interface Range {
  start: BigNum
  end: BigNum
}

export interface BlockRange extends Range {
  block: BigNum
}

/**
 * RangeStore makes it easy to store ranges.
 * When ranges are added, only the sections with
 * a higher block number than existing ranges
 * that they overlap with will be inserted.
 */
export class RangeStore<T extends BlockRange> {
  public ranges: T[]

  constructor(ranges: T[] = []) {
    this.ranges = ranges
  }

  /**
   * Merges the ranges of another RangeStore into this one.
   * @param other The other RangeStore.
   */
  public merge(other: RangeStore<T>): void {
    for (const range of other.ranges) {
      this.addRange(range)
    }
  }

  /**
   * Returns the sections of existing ranges
   * that overlap with the given range.
   * @param range Range to overlap with.
   * @returns a list of existing ranges.
   */
  public getOverlapping(range: Range): T[] {
    return this.ranges.map((existing) => {
      return {
        ...existing,
        start: bnMax(existing.start, range.start),
        end: bnMin(existing.end, range.end),
      }
    })
  }

  /**
   * Adds a range to the range store.
   * Will pieces of the range with a higher
   * block number than the existing ranges
   * they overlap with.
   * @param range Range to add.
   */
  public addRange(range: T): void {
    if (range.start.gte(range.end)) {
      throw new Error('Invalid range')
    }

    const toAdd = new RangeStore([range])
    for (const overlap of this.getOverlapping(range)) {
      if (overlap.block.gt(range.block)) {
        // Existing range has a greater block number,
        // don't add this part of the new range.
        toAdd.removeRange(overlap)
      } else {
        // New range has a greater block number,
        // remove this part of the old range.
        this.removeRange(overlap)
      }
    }

    this.ranges = this.ranges.concat(toAdd.ranges)
    this.sortRanges()
  }

  /**
   * Removes a range from the store.
   * @param range Range to remove.
   */
  public removeRange(range: Range): void {
    for (const overlap of this.getOverlapping(range)) {
      // Remove the old range entirely.
      this.ranges = this.ranges.filter((r) => {
        return !r.start.eq(overlap.start)
      })

      // Add back any of the left or right
      // portions of the old snapshot that didn't
      // overlap with the piece being removed.
      // For visual intuition:
      //
      // [-----------]   old snapshot
      //     [---]       removed range
      // |xxx|           left remainder
      //         |xxx|   right remainder

      // Add left remainder.
      if (overlap.start.lt(overlap.start)) {
        this.ranges.push({
          ...overlap,
          end: overlap.start,
        })
      }

      // Add right remainder.
      if (overlap.end.gt(overlap.end)) {
        this.ranges.push({
          ...overlap,
          start: overlap.end,
        })
      }
    }

    this.sortRanges()
  }

  /**
   * Increments the block number of any parts of ranges
   * that intersect with the given range.
   * @param range Range to increment.
   */
  public incrementBlocks(range: Range): void {
    if (range.start.gte(range.end)) {
      throw new Error('Invalid range')
    }

    for (const existing of this.ranges) {
      const overlap: Range = {
        start: bnMax(existing.start, range.start),
        end: bnMin(existing.end, range.end),
      }

      // No overlap, can skip.
      if (overlap.start.gte(overlap.end)) {
        continue
      }

      this.addRange({
        ...existing,
        ...overlap,
        ...{
          block: existing.block.addn(1),
        },
      })
    }
  }

  /**
   * Sorts ranges by start.
   */
  private sortRanges(): void {
    this.ranges = this.ranges.sort((a, b) => {
      return a.start.sub(b.start).toNumber()
    })
  }
}
