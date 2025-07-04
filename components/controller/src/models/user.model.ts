import mongoose, { Schema, model, Model } from 'mongoose';
import validator from 'validator/index';
import { toJSON, paginate } from './plugins/index';
import { roles } from '../config/roles';
import { generator } from '../services/document.service';
import { Cooperative } from 'cooptypes';
import { userStatus, type IUser } from '../types/user.types';

const { isEmail } = validator;

interface IUserModel extends Model<IUser> {
  isEmailTaken(email: string, excludeUsername?: string): Promise<boolean>;
  paginate(filter, options): any;
}

const userSchema = new Schema<IUser, IUserModel>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(userStatus),
      default: userStatus['1_Created'],
    },
    message: {
      type: String,
      required: false,
    },
    is_registered: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      required: true,
      enum: ['individual', 'entrepreneur', 'organization'],
    },
    public_key: {
      type: String,
      default: '',
    },
    referer: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      required: false,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },
    role: {
      type: String,
      enum: roles,
      default: 'user',
    },
    is_email_verified: {
      type: Boolean,
      default: false,
    },
    has_account: {
      type: Boolean,
      default: false,
    },
    initial_order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    subscriber_id: {
      type: String,
      default: '',
    },
    subscriber_hash: {
      type: String,
      default: '',
    },
  },
  {
    minimize: false,
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

userSchema.statics.isEmailTaken = async function (email: string, excludeUsername?: string) {
  const user = await this.findOne({ email, username: { $ne: excludeUsername } });

  return !!user;
};

// Хук после find для автоматического добавления private_data
userSchema.post('find', async function (docs) {
  for (const doc of docs) {
    // Наполняем пользователя с помощью populate
    doc.private_data = await doc.getPrivateData();
  }
});

// Хук после findOne для автоматического добавления private_data
userSchema.post('findOne', async function (doc) {
  if (doc) {
    doc.private_data = await doc.getPrivateData();
  }
});

// Виртуальное свойство для private_data
userSchema
  .virtual('private_data')
  .get(function () {
    return this._privateData; // Чтение из временного поля
  })
  .set(function (value) {
    this._privateData = value; // Установка временного поля
  });

// Асинхронный метод получения private_data
userSchema.methods.getPrivateData = async function (): Promise<
  Cooperative.Users.IIndividualData | Cooperative.Users.IEntrepreneurData | Cooperative.Users.IOrganizationData | null
> {
  const privateData = (await generator.get(this.type, { username: this.username })) as
    | Cooperative.Users.IIndividualData
    | Cooperative.Users.IEntrepreneurData
    | Cooperative.Users.IOrganizationData
    | null;
  this.private_data = privateData; // Устанавливаем виртуальное свойство
  return privateData;
};

const User = model<IUser, IUserModel>('User', userSchema);

export default User;

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *         status:
 *           type: string
 *           enum: ['created', 'joined', 'payed', 'registered', 'active', 'blocked']
 *         is_registered:
 *           type: boolean
 *         type:
 *           type: string
 *           enum: ['individual', 'entrepreneur', 'organization']
 *         public_key:
 *           type: string
 *         referer:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *         is_email_verified:
 *           type: boolean
 *         private_data:
 *           oneOf:
 *             - $ref: '#/components/schemas/IEntrepreneurData'
 *             - $ref: '#/components/schemas/IIndividualData'
 *             - $ref: '#/components/schemas/IOrganizationData'
 *           nullable: true
 */
