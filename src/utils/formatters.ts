/**
 * Format a time duration in seconds to a human-readable string
 * @param seconds Time in seconds
 * @returns Formatted time string (e.g. "1:23" or "12:34")
 */
export function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Format a number with thousands separators
   * @param num Number to format
   * @returns Formatted number string (e.g. "1,234,567")
   */
  export function formatNumber(num: number): string {
    return num.toLocaleString();
  }
  
  /**
   * Format a percentage value
   * @param value Decimal value (e.g. 0.75)
   * @param decimalPlaces Number of decimal places
   * @returns Formatted percentage string (e.g. "75%")
   */
  export function formatPercent(value: number, decimalPlaces = 0): string {
    return `${(value * 100).toFixed(decimalPlaces)}%`;
  }
  
  /**
   * Create a shortened version of a long string with ellipsis
   * @param str String to truncate
   * @param maxLength Maximum length
   * @returns Truncated string with ellipsis if needed
   */
  export function truncateString(str: string, maxLength = 30): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Format a damage value with color and symbol
   * @param damage Damage amount
   * @param isCritical Whether it's a critical hit
   * @returns HTML string with formatted damage
   */
  export function formatDamage(damage: number, isCritical = false): string {
    if (isCritical) {
      return `<span class="text-yellow-500 font-bold">⚡ ${damage}</span>`;
    }
    return `<span class="text-red-500">-${damage}</span>`;
  }
  
  /**
   * Format a healing value with color and symbol
   * @param healing Healing amount
   * @returns HTML string with formatted healing
   */
  export function formatHealing(healing: number): string {
    return `<span class="text-green-500">+${healing}</span>`;
  }
  
  /**
   * Convert milliseconds to a human-readable duration string
   * @param ms Time in milliseconds
   * @returns Formatted duration string (e.g. "2h 34m 12s")
   */
  export function formatDuration(ms: number): string {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    const parts = [];
    
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    
    return parts.join(' ');
  }
  
  /**
   * Format a date to a short readable string
   * @param date Date to format
   * @returns Formatted date string (e.g. "Mar 15, 2023")
   */
  export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }