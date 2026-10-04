/** Tracks resume decisions for the currently mounted inspection flow. */
export class InspectionDraftSession {
  private readonly resolvedKeys = new Set<string>();

  shouldCheck(key: string): boolean {
    if (this.resolvedKeys.has(key)) return false;
    this.resolvedKeys.add(key);
    return true;
  }

  leave(key: string): void {
    this.resolvedKeys.delete(key);
  }
}
