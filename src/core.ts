import base32 from 'hi-base32';
import { randomstring } from '@sidoshi/random-string';

import { Encoding, Algorithm } from './types';
import {
  generateCounterFromTime,
  hmacHash,
  dynamicTruncate,
} from './internals';

export interface HOTPGenerateOptions {
  // The secret key to use for HOTP generation
  secret: string;
  // The incremental counter value
  counter: number;
  // The length of generated OTP (default: 6)
  digits?: number;
  // The encoding in which the secret key is provided (default: 'ascii')
  encoding?: Encoding;
  // The algorithm to use for HMAC hashing (default: 'sha1')
  algorithm?: Algorithm;
}

const hoptGenerateDefaults = {
  encoding: 'ascii' as Encoding,
  algorithm: 'sha1' as Algorithm,
  digits: 6,
};

/**
 * Generate HMAC based OTP.
 */
export function hotpGenerate(options: HOTPGenerateOptions): string {
  const opts = { ...hoptGenerateDefaults, ...options };
  const hash = hmacHash(opts);
  const code = dynamicTruncate(hash);

  return code.toString().substr(-opts.digits);
}

export interface HOTPVerifyOptions {
  secret: string;
  counter: number;
  // The OTP to verify against
  code: string;
  // The look-ahead window for resynchronization (default: 0)
  window?: number;
  digits?: number;
  encoding?: Encoding;
  algorithm?: Algorithm;
}

const hotpVerifyDefaults = {
  ...hoptGenerateDefaults,
  window: 0,
};

export interface OTPVerificationResult {
  valid: boolean;
  delta?: number;
}

export function hotpVerify(options: HOTPVerifyOptions): OTPVerificationResult {
  const opts = { ...hotpVerifyDefaults, ...options };

  for (let c = opts.counter; c <= opts.counter + opts.window; c += 1) {
    const code = hotpGenerate({
      ...opts,
      counter: c,
    });

    // Convert the given code to string in case it is a number
    if (code === opts.code.toString()) {
      return {
        valid: true,
        delta: c - opts.counter,
      };
    }
  }

  return {
    valid: false,
  };
}

export interface TOTPGenerateOptions {
  // The secret key to use for TOTP generation
  secret: string;
  // The timestamp in seconds to use (default: current time)
  time?: number;
  // Number of steps in seconds for incrementing counter (default: 30)
  step?: number;
  // The length of generated OTP (default: 6)
  digits?: number;
  // The encoding in which the secret key is provided (default: 'ascii')
  encoding?: Encoding;
  // The algorithm to use for HMAC hashing (default: 'sha1')
  algorithm?: Algorithm;
}

const totpGenerateDefaults = {
  step: 30,
  digits: 6,
  encoding: 'ascii' as Encoding,
  algorithm: 'sha1' as Algorithm,
};

/**
 * Generate Time based OTP.
 */
export function totpGenerate(options: TOTPGenerateOptions): string {
  const opts = { ...totpGenerateDefaults, ...options };
  const counter = generateCounterFromTime(opts.time, opts.step);

  return hotpGenerate({
    ...opts,
    counter,
  });
}

export interface TOTPVerifyOptions {
  secret: string;
  // The OTP to verify against
  code: string;
  // The two-sided leeway window for passcode resynchronization
  window?: number;
  time?: number;
  step?: number;
  digits?: number;
  encoding?: Encoding;
  algorithm?: Algorithm;
}

const totpVerifyDefaults = {
  ...totpGenerateDefaults,
  window: 0,
};

export function totpVerify(options: TOTPVerifyOptions): OTPVerificationResult {
  const opts = {
    ...totpVerifyDefaults,
    ...options,
  };
  let counter = generateCounterFromTime(opts.time, opts.step);
  // Adjust 2-way window to 1-way
  counter -= opts.window;
  const window = opts.window * 2;
  const result = hotpVerify({
    ...opts,
    window,
    counter,
  });

  // Reset window adjustments
  if (result.valid && typeof result.delta === 'number') {
    result.delta -= opts.window;
  }

  return result;
}

interface SecretOptions {
  length?: number;
}

const defaultSecretOptions = {
  length: 12,
};

type SecretResult = {
  [k in Encoding]: string;
};

export function generateSecret(options: SecretOptions = {}): SecretResult {
  const opts = { ...defaultSecretOptions, ...options };
  const secret = randomstring(opts.length);

  return {
    ascii: secret,
    hex: Buffer.from(secret, 'ascii').toString('hex'),
    base32: base32.encode(Buffer.from(secret, 'ascii')).replace(/=/g, ''),
    base64: Buffer.from(secret, 'ascii').toString('base64'),
  };
}
