import pino from "pino";

const log = pino(
  {
    level: Bun.env.LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string): { level: string } => ({ level: label }),
      bindings: (): Record<string, unknown> => ({}),
    },
    ...((Bun.env.LOG_PRETTY_PRINT ?? false) && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: "UTC:mm/dd/yyyy, h:MM:ss TT Z",
        },
      },
    }),
  },
  pino.destination(2), // 2 means write to stderr; prevents interference with StdioServerTransport (stdout)
);

export default log;
