import { DataTypes } from 'sequelize';
import sequelize from './db.js';

const Submission = sequelize.define('Submission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'anonymous_user',
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  module_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'essay',
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  subscores: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  mistakes: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
  },
  top_issue: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '',
  },
  improvement: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '',
  },
  unclear: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  ocr_confidence: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0.0,
  },
  extracted_text: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
  },
  corrected_text: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
  },
  total_score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  scores: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      grammar: 0,
      spelling: 0,
      clarity: 0,
      total: 0,
    },
  },
}, {
  timestamps: true, // Automatically manages createdAt (timestamp) and updatedAt
});

export default Submission;
