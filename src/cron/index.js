import cron from 'node-cron';

export const cronManager = async () => {
  /**
   * @description simple cron every 5 min
   */
  cron.schedule('*/5 * * * *', async () => {
    // biome-ignore lint/suspicious/noConsole: cron example
    console.log('cron');
  });
};
