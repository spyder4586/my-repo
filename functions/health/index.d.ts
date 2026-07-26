export default function health(_context: any, basicIO?: any): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        status: string;
        env: import("./common/config").AppEnv;
    };
}>;
