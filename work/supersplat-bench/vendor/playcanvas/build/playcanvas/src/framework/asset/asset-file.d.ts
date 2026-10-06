/**
 * Wraps a source of asset data.
 */
export class AssetFile {
    constructor(url?: string, filename?: string, hash?: any, size?: any, opt?: any, contents?: any);
    url: string;
    filename: string;
    hash: any;
    size: any;
    opt: any;
    contents: any;
    equals(other: any): boolean;
}
