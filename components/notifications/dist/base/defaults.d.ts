import { PreferencesConfig, ChannelsConfig, ChannelConfig } from '../types';
export declare const createChannelConfig: (enabled: boolean, readOnly?: boolean) => ChannelConfig;
export declare const createDefaultChannelsConfig: () => ChannelsConfig;
export declare const createDefaultPreferences: () => PreferencesConfig;
export declare const createEmailStep: (name: string, subject: string, body: string) => {
    name: string;
    type: "email";
    controlValues: {
        subject: string;
        body: string;
        editorType: "html";
    };
};
export declare const createInAppStep: (name: string, subject: string, body: string, avatar?: string) => {
    name: string;
    type: "in_app";
    controlValues: {
        subject: string;
        body: string;
        avatar: string;
    };
};
export declare const createPushStep: (name: string, title: string, body: string) => {
    name: string;
    type: "push";
    controlValues: {
        subject: string;
        body: string;
    };
};
export declare const createSmsStep: (name: string, body: string) => {
    name: string;
    type: "sms";
    controlValues: {
        body: string;
    };
};
