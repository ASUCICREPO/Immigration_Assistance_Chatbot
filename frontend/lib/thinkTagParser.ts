/**
 * Stateful streaming parser for <think>...</think> tags.
 *
 * Processes incremental text chunks and emits classified segments.
 * Handles partial tags at chunk boundaries by buffering text that
 * could be the start of a tag.
 */

export interface ParsedSegment {
  type: 'content' | 'reasoning';
  text: string;
}

export class ThinkTagParser {
  private buffer: string = '';
  private inThinkBlock: boolean = false;

  private static readonly OPEN_TAG = '<think>';
  private static readonly CLOSE_TAG = '</think>';

  /**
   * Feed a new chunk of text into the parser.
   * Returns an array of classified segments to emit.
   */
  processChunk(chunk: string): ParsedSegment[] {
    this.buffer += chunk;
    const segments: ParsedSegment[] = [];

    while (this.buffer.length > 0) {
      if (!this.inThinkBlock) {
        const openIdx = this.buffer.indexOf(ThinkTagParser.OPEN_TAG);

        if (openIdx !== -1) {
          const before = this.buffer.slice(0, openIdx);
          if (before) {
            segments.push({ type: 'content', text: before });
          }
          this.buffer = this.buffer.slice(openIdx + ThinkTagParser.OPEN_TAG.length);
          this.inThinkBlock = true;
          continue;
        }

        // Check if the buffer ends with a partial match for "<think>"
        const holdBack = this.getPartialTagPrefixLength(
          this.buffer, ThinkTagParser.OPEN_TAG
        );

        if (holdBack > 0) {
          const safe = this.buffer.slice(0, this.buffer.length - holdBack);
          if (safe) {
            segments.push({ type: 'content', text: safe });
          }
          this.buffer = this.buffer.slice(this.buffer.length - holdBack);
          break;
        }

        segments.push({ type: 'content', text: this.buffer });
        this.buffer = '';
        break;
      } else {
        const closeIdx = this.buffer.indexOf(ThinkTagParser.CLOSE_TAG);

        if (closeIdx !== -1) {
          const reasoning = this.buffer.slice(0, closeIdx);
          if (reasoning) {
            segments.push({ type: 'reasoning', text: reasoning });
          }
          this.buffer = this.buffer.slice(closeIdx + ThinkTagParser.CLOSE_TAG.length);
          this.inThinkBlock = false;
          continue;
        }

        // Check if buffer ends with partial "</think>"
        const holdBack = this.getPartialTagPrefixLength(
          this.buffer, ThinkTagParser.CLOSE_TAG
        );

        if (holdBack > 0) {
          const safe = this.buffer.slice(0, this.buffer.length - holdBack);
          if (safe) {
            segments.push({ type: 'reasoning', text: safe });
          }
          this.buffer = this.buffer.slice(this.buffer.length - holdBack);
          break;
        }

        segments.push({ type: 'reasoning', text: this.buffer });
        this.buffer = '';
        break;
      }
    }

    return segments;
  }

  /**
   * Flush any remaining buffered content (call on stream end).
   * Partial tags that never completed are emitted as-is.
   */
  flush(): ParsedSegment[] {
    if (!this.buffer) return [];

    const segment: ParsedSegment = {
      type: this.inThinkBlock ? 'reasoning' : 'content',
      text: this.buffer,
    };
    this.buffer = '';
    this.inThinkBlock = false;
    return [segment];
  }

  /**
   * Check if the end of `text` matches a prefix of `tag`.
   * Returns the length of the matching suffix, or 0 if no match.
   *
   * Example: text="abc<thi", tag="<think>" -> returns 4 ("<thi")
   */
  private getPartialTagPrefixLength(text: string, tag: string): number {
    const maxCheck = Math.min(text.length, tag.length - 1);
    for (let len = maxCheck; len >= 1; len--) {
      if (text.endsWith(tag.slice(0, len))) {
        return len;
      }
    }
    return 0;
  }

  /** Set the parser's think-block state. */
  setInThinkBlock(value: boolean): void {
    this.inThinkBlock = value;
  }

  /** Whether the parser is currently inside a think block. */
  get isInThinkBlock(): boolean {
    return this.inThinkBlock;
  }

  /** Reset parser state. */
  reset(): void {
    this.buffer = '';
    this.inThinkBlock = false;
  }
}

/**
 * One-shot utility: strip all think tags from a completed string.
 * Used as a final sanitization pass before rendering.
 */
export function stripThinkTags(text: string): string {
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  result = result.replace(/<\/?think>/g, '');
  return result;
}
