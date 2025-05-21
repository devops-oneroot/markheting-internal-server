import PQueue from "p-queue";

const webhookQueue = new PQueue({ concurrency: 2 });

export default webhookQueue;
