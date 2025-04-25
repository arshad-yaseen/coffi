class Logger {
    private static instance: Logger;
    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public warn(message: string): void {
        const yellowColor = "\x1b[33m";
        const resetColor = "\x1b[0m";
        console.warn(`${yellowColor}WARNING: ${message}${resetColor}`);
    }

    public debug(message: string): void {
        const blueColor = "\x1b[34m";
        const resetColor = "\x1b[0m";
        console.debug(`${blueColor}DEBUG: ${message}${resetColor}`);
    }
}

export const logger = Logger.getInstance();
