"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSmsStep = exports.createPushStep = exports.createInAppStep = exports.createEmailStep = exports.createDefaultPreferences = exports.createDefaultChannelsConfig = exports.createChannelConfig = void 0;
// Базовая конфигурация канала
const createChannelConfig = (enabled, readOnly = false) => ({
    enabled,
    readOnly,
});
exports.createChannelConfig = createChannelConfig;
// Базовая конфигурация каналов
const createDefaultChannelsConfig = () => ({
    email: (0, exports.createChannelConfig)(true),
    sms: (0, exports.createChannelConfig)(false),
    in_app: (0, exports.createChannelConfig)(true),
    push: (0, exports.createChannelConfig)(false),
    chat: (0, exports.createChannelConfig)(false),
});
exports.createDefaultChannelsConfig = createDefaultChannelsConfig;
// Базовые preferences для воркфлоу
const createDefaultPreferences = () => ({
    user: {
        all: (0, exports.createChannelConfig)(true),
        channels: (0, exports.createDefaultChannelsConfig)(),
    },
    workflow: {
        all: (0, exports.createChannelConfig)(true),
        channels: (0, exports.createDefaultChannelsConfig)(),
    },
});
exports.createDefaultPreferences = createDefaultPreferences;
// Вспомогательные функции для создания шагов
const createEmailStep = (name, subject, body) => ({
    name,
    type: 'email',
    controlValues: {
        subject,
        body,
        editorType: 'html',
    },
});
exports.createEmailStep = createEmailStep;
const createInAppStep = (name, subject, body, avatar) => ({
    name,
    type: 'in_app',
    controlValues: {
        subject,
        body,
        avatar: avatar || 'https://novu.coopenomics.world/images/bell.svg',
    },
});
exports.createInAppStep = createInAppStep;
const createPushStep = (name, title, body) => ({
    name,
    type: 'push',
    controlValues: {
        subject: title,
        body,
    },
});
exports.createPushStep = createPushStep;
const createSmsStep = (name, body) => ({
    name,
    type: 'sms',
    controlValues: {
        body,
    },
});
exports.createSmsStep = createSmsStep;
