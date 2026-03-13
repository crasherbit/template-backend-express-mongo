import { app } from './app.js';
import { cronManager } from './cron/index.js';
import { initDb } from './utils/dbConnector.js';

initDb()
  .then(() => {
    // biome-ignore lint/suspicious/noConsole: startup log
    console.log('--- connected to database successfully');
    app.listen(app.get('port'), () => {
      cronManager();
      // biome-ignore lint/suspicious/noConsole: startup log
      console.log(
        '--- App is running at http://localhost:%d in %s mode',
        app.get('port'),
        app.get('env')
      );
    });
  })
  // biome-ignore lint/suspicious/noConsole: startup error
  .catch((e) => console.log('Error connecting to database:', e));
