import {Logger, Level} from 'loge';

class ConsoleLogger extends Logger {
  log(level: Level, args: any[]) {
    if (level >= this.level) {
      console.log(`[${Level[level]}] `, args);
    }
  }
}

const logger = new ConsoleLogger(null, Level.info);

export default logger;
