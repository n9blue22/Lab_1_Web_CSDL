require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shop_mongoose_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log("-> Kết nối MongoDB thành công qua Mongoose ODM!"))
  .catch(err => console.error("Lỗi kết nối MongoDB:", err));

// Định nghĩa userSchema
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Full name must be at least 2 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email format']
  },
  password: {
    type: String,
    default: '123456'
  },
  // Question 1: Custom validation Regex cho số điện thoại VN
  phone: {
    type: String,
    validate: {
      validator: function(v) {
        return /^(03|05|07|08|09)\d{8}$/.test(v);
      },
      message: props => `${props.value} không phải là số điện thoại Việt Nam hợp lệ!`
    }
  },
  age: {
    type: Number,
    min: [18, 'User age must be at least 18'],
    max: [100, 'Invalid age']
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'manager'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Question 4: Trường phục vụ Soft Delete
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Question 2: Virtual property displayInfo
userSchema.virtual('displayInfo').get(function() {
  return `${this.fullName} <${this.email}> [${this.role.toUpperCase()}]`;
});

// Question 3: Static method findActiveByRole(roleName)
userSchema.statics.findActiveByRole = function(roleName) {
  return this.find({ role: roleName, isActive: true }).sort({ fullName: 1 });
};

// Question 4: Instance method softDelete()
userSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.isActive = false;
  return this.save();
};

// Question 5a: Pre-save hook (Đã sửa bỏ next)
userSchema.pre('save', function() {
  if (this.isModified('password')) {
    console.log(`[Middleware Pre-save] Giả lập mã hóa mật khẩu cho người dùng: ${this.fullName}`);
    this.password = `hashed_${this.password}`;
  }
});

// Question 5b: Pre-find hook (Đã sửa bỏ next)
userSchema.pre(/^find/, function() {
  this.where({ isDeleted: { $ne: true } });
});

const User = mongoose.model('User', userSchema);

async function runMongooseDemo() {
  try {
    await User.deleteMany({}); // Xóa dữ liệu cũ

    console.log('\n--- THỰC THI Q1 - Q5 MỞ RỘNG CỦA EXERCISE 3 ---');

    // 1. Kiểm tra Q1 (Phone Validation)
    try {
      await User.create({
        fullName: "Test Invalid Phone",
        email: "badphone@example.com",
        age: 20,
        phone: "123456" // SĐT sai
      });
    } catch (err) {
      console.log('Q1 (Validation Error thành công):', err.errors?.phone?.message || err.message);
    }

    // Tạo các người dùng hợp lệ
    const user1 = await User.create({
      fullName: "Nguyen Van Hung",
      email: "hung.nguyen@example.com",
      phone: "0912345678",
      age: 22,
      role: "admin",
      password: "mysecretpassword"
    });

    const user2 = await User.create({
      fullName: "An Tran",
      email: "an.tran@example.com",
      phone: "0987654321",
      age: 25,
      role: "admin"
    });

    // 2. Kiểm tra Q2 (Virtual Property)
    console.log('\nQ2 (Virtual Property displayInfo):', user1.displayInfo);

    // 3. Kiểm tra Q3 (Static Method)
    const activeAdmins = await User.findActiveByRole('admin');
    console.log('\nQ3 (Static method findActiveByRole - xếp A-Z):', activeAdmins.map(u => u.fullName));

    // 4. Kiểm tra Q4 (Instance Method - Soft Delete)
    await user2.softDelete();
    console.log(`\nQ4 (Soft delete): Đã xóa mềm user ${user2.fullName}. IsDeleted = ${user2.isDeleted}`);

    // 5. Kiểm tra Q5 (Pre-find Query Hook)
    const allUsersAfterDelete = await User.find({});
    console.log('\nQ5 (Pre-find hook tự động lọc soft deleted):');
    console.log('Danh sách user còn lại khi tìm kiếm:', allUsersAfterDelete.map(u => u.fullName));
    console.log('Mật khẩu của user1 sau khi qua Pre-save hook:', user1.password);

  } catch (error) {
    console.error("Mongoose operation error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("\n-> Đã đóng kết nối Mongoose.");
  }
}

runMongooseDemo();