/**
 * @import { AppBase } from '../app-base.js'
 */
export class GSplatHandler extends ResourceHandler {
    /**
     * Create a new GSplatHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app: AppBase);
    parser: PlyParser;
    load(url: any, callback: any, asset: any): void;
    open(url: any, data: any, asset: any): import("../parsers/gsplat-resource.js").GSplatResource;
}
import { ResourceHandler } from './handler.js';
import { PlyParser } from '../parsers/ply.js';
import type { AppBase } from '../app-base.js';
