import { Alert } from 'react-native';

// Error types for better categorization
export enum ErrorType {
  DATABASE = 'DATABASE',
  FILE_SYSTEM = 'FILE_SYSTEM',
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  CAMERA = 'CAMERA',
  VALIDATION = 'VALIDATION',
  UNKNOWN = 'UNKNOWN'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Error interface
export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  originalError?: unknown;
  timestamp: Date;
  context?: string;
}

// Error mapping for user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  // Database errors
  'SQLiteErrorException': 'Database connection issue. Please try again.',
  'duplicate column name': 'Database update in progress. Please wait a moment.',
  'no such table': 'Database initialization issue. Please restart the app.',
  'database is locked': 'Database is busy. Please try again in a moment.',
  
  // File system errors
  'ENOENT': 'File not found. Please check if the file exists.',
  'EACCES': 'Permission denied. Please check file permissions.',
  'ENOSPC': 'Not enough storage space. Please free up some space.',
  
  // Authentication errors
  'USER_CANCELED': 'Sign-in was cancelled.',
  'NETWORK_ERROR': 'Network connection issue. Please check your internet.',
  'INVALID_CREDENTIALS': 'Invalid credentials. Please try again.',
  
  // Camera errors
  'Camera is not ready': 'Camera is initializing. Please wait a moment.',
  'Permission denied': 'Camera permission is required. Please enable it in settings.',
  'Camera unavailable': 'Camera is not available on this device.',
  
  // Validation errors
  'Text strings must be rendered within a <Text> component': 'Display issue detected. Please refresh the app.',
  'Cannot read property': 'Data loading issue. Please try again.',
  
  // Network errors
  'Network request failed': 'Network connection issue. Please check your internet.',
  'Timeout': 'Request timed out. Please try again.',
  
  // Default
  'UNKNOWN': 'Something went wrong. Please try again.'
};

// Error logger
export class ErrorLogger {
  private static logs: AppError[] = [];
  
  static log(error: AppError): void {
    // Add to logs
    this.logs.push(error);
    
    // Log to console for development
    console.error(`[${error.severity}] ${error.type}: ${error.message}`, {
      originalError: error.originalError,
      context: error.context,
      timestamp: error.timestamp
    });
    
    // Keep only last 100 errors to prevent memory issues
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
  }
  
  static getLogs(): AppError[] {
    return [...this.logs];
  }
  
  static clearLogs(): void {
    this.logs = [];
  }
}

// Error handler class
export class ErrorHandler {
  private static errorToMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error ?? 'Unknown error');
  }

  static handle(error: unknown, context?: string): AppError {
    const appError = this.createAppError(error, context);
    ErrorLogger.log(appError);
    return appError;
  }
  
  static createAppError(error: unknown, context?: string): AppError {
    const errorMessage = this.errorToMessage(error);
    const errorType = this.categorizeError(error);
    const severity = this.determineSeverity(error, errorType);
    const userMessage = this.getUserMessage(errorMessage);
    
    return {
      type: errorType,
      severity,
      message: errorMessage,
      userMessage,
      originalError: error,
      timestamp: new Date(),
      context
    };
  }
  
  private static categorizeError(error: unknown): ErrorType {
    const message = this.errorToMessage(error);
    
    if (message.includes('SQLite') || message.includes('database')) {
      return ErrorType.DATABASE;
    }
    if (message.includes('ENOENT') || message.includes('file')) {
      return ErrorType.FILE_SYSTEM;
    }
    if (message.includes('auth') || message.includes('sign') || message.includes('login')) {
      return ErrorType.AUTHENTICATION;
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('request')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('camera') || message.includes('Camera')) {
      return ErrorType.CAMERA;
    }
    if (message.includes('Text') || message.includes('component') || message.includes('render')) {
      return ErrorType.VALIDATION;
    }
    
    return ErrorType.UNKNOWN;
  }
  
  private static determineSeverity(error: unknown, type: ErrorType): ErrorSeverity {
    const message = this.errorToMessage(error);
    // Critical errors that break the app
    if (type === ErrorType.DATABASE && message.includes('no such table')) {
      return ErrorSeverity.CRITICAL;
    }
    
    // High severity errors that affect core functionality
    if (type === ErrorType.AUTHENTICATION || type === ErrorType.CAMERA) {
      return ErrorSeverity.HIGH;
    }
    
    // Medium severity errors that affect features
    if (type === ErrorType.FILE_SYSTEM || type === ErrorType.NETWORK) {
      return ErrorSeverity.MEDIUM;
    }
    
    // Low severity errors that are minor
    return ErrorSeverity.LOW;
  }
  
  private static getUserMessage(errorMessage: string): string {
    // Check for exact matches first
    for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
      if (errorMessage.includes(key)) {
        return message;
      }
    }
    
    // Return default message
    return ERROR_MESSAGES.UNKNOWN;
  }
  
  // Show error to user
  // TODO: Convert to use GlassActionSheet when we have a global error context
  static showError(error: AppError, showAlert: boolean = true): void {
    if (showAlert && error.severity !== ErrorSeverity.LOW) {
      console.log('🔄 ErrorHandler: Using Alert.alert (TODO: Convert to GlassActionSheet)');
      Alert.alert(
        'Error',
        error.userMessage,
        [
          { text: 'OK', style: 'default' },
          ...(error.severity === ErrorSeverity.CRITICAL ? 
            [{ text: 'Restart App', style: 'destructive' as const }] : [])
        ]
      );
    }
  }
  
  // Handle error with user notification
  static handleWithNotification(error: unknown, context?: string, showAlert: boolean = true): AppError {
    const appError = this.handle(error, context);
    this.showError(appError, showAlert);
    return appError;
  }
}

// Utility function for wrapping async operations
export function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string,
  showAlert: boolean = true
): Promise<T> {
  return operation().catch((error) => {
    const appError = ErrorHandler.handleWithNotification(error, context, showAlert);
    throw appError;
  });
}

// Utility function for wrapping sync operations
export function withErrorHandlingSync<T>(
  operation: () => T,
  context?: string,
  showAlert: boolean = true
): T {
  try {
    return operation();
  } catch (error) {
    const appError = ErrorHandler.handleWithNotification(error, context, showAlert);
    throw appError;
  }
}
