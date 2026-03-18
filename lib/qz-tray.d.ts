declare module "qz-tray" {
    interface QZ {
        websocket: {
            connect(): Promise<void>;
            disconnect(): Promise<void>;
            isActive(): boolean;
        };
        security: {
            setCertificatePromise(callback: () => Promise<string>): void;
            setSignatureAlgorithm(algorithm: string): void;
            setSignaturePromise(callback: () => Promise<string>): void;
        };
        printers: {
            getDefault(): Promise<string>;
            find(query?: string): Promise<string[]>;
        };
        configs: {
            create(printer: string, options?: object): object;
        };
        print(config: object, data: object[]): Promise<void>;
    }

    const qz: QZ;
    export default qz;
}
