/**
 *
 * @param dateString
 * Check if date string in the format MM/DD/YY(YY) is valid (year can be 2 or 4 digits)
 * Zero padding not required for month and day
 * Validate date after string check using Date object
 * Returns Date object if valid, null if invalid
 */
export function parseAndValidateDate(dateString: string): Date | null {
    const regex =
        /^(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|1\d|2\d|3[01])\/(?:\d{2}|\d{4})$/;
    if (!regex.test(dateString)) {
        return null;
    }
    const [month, day, year] = dateString.split("/").map(Number);
    // normalize year to 4 digits
    const date = new Date(2000 + (year % 100), month - 1, day);
    // check for invalid dates but valid date strings
    if (
        date.getFullYear() !== 2000 + (year % 100) ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }
    return date;
}

function zeroPad(num: number): string {
    if (num < 0) {
        throw new Error("Negative numbers not allowed");
    }
    return num < 10 ? `0${num}` : `${num}`;
}

/**
 *
 * @param date
 * Convert Date object to MM/DD/YYYY format string
 */
export function getDateString(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${zeroPad(month)}/${zeroPad(day)}/${year}`;
}
