import { GenericError } from "./errors";

console.log("Worker works!!");

self.postMessage(`Your lock timeout!: ${new GenericError("sss").message}`);
