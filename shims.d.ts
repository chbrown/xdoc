// from node.d.ts
interface NodeRequireFunction {
    (id: string): any;
}
interface NodeRequire extends NodeRequireFunction {
    resolve(id:string): string;
}
declare var require: NodeRequire;
