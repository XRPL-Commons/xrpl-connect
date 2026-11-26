type RecordLike = Record<string, unknown>;

export interface PasskeyCredentialLike {
  id: string;
  rawId: ArrayBuffer;
  type: string;
  authenticatorAttachment?: string | null;
  response: {
    clientDataJSON: ArrayBuffer;
    authenticatorData?: ArrayBuffer;
    signature?: ArrayBuffer;
    userHandle?: ArrayBuffer | null;
    attestationObject?: ArrayBuffer;
    getTransports?: () => string[];
  };
  getClientExtensionResults(): RecordLike;
}

function asRecord(value: unknown): RecordLike | null {
  return typeof value === 'object' && value !== null ? (value as RecordLike) : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  if (typeof atob !== 'function') throw new Error('Privy passkeys require browser base64 support');
  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

export function bytesToBase64Url(value: ArrayBuffer | ArrayBufferView): string {
  if (typeof btoa !== 'function') throw new Error('Privy passkeys require browser base64 support');
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function passkeyExtensions(
  value: unknown
): AuthenticationExtensionsClientInputs | undefined {
  const extensions = asRecord(value);
  if (!extensions) return undefined;

  const result: AuthenticationExtensionsClientInputs = {};
  if (isNonEmptyString(extensions.app_id)) result.appid = extensions.app_id;
  if (typeof extensions.cred_props === 'boolean') {
    result.credProps = extensions.cred_props;
  } else if (extensions.cred_props !== undefined && extensions.cred_props !== null) {
    result.credProps = true;
  }
  if (typeof extensions.hmac_create_secret === 'boolean') {
    result.hmacCreateSecret = extensions.hmac_create_secret;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function passkeyCredentialDescriptors(
  value: unknown
): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry) => {
    const descriptor = asRecord(entry);
    if (!descriptor || !isNonEmptyString(descriptor.id) || descriptor.type !== 'public-key') {
      return [];
    }
    const transports = Array.isArray(descriptor.transports)
      ? descriptor.transports
          .filter(isNonEmptyString)
          .map((transport) => transport as AuthenticatorTransport)
      : undefined;
    return [
      {
        id: base64UrlToBytes(descriptor.id) as unknown as ArrayBuffer,
        type: 'public-key' as const,
        ...(transports && transports.length > 0 ? { transports } : {}),
      },
    ];
  });
}

export function asPasskeyCredential(value: Credential | null): PasskeyCredentialLike {
  const credential = value as unknown as PasskeyCredentialLike | null;
  if (
    !credential ||
    !isNonEmptyString(credential.id) ||
    !isNonEmptyString(credential.type) ||
    !(credential.rawId instanceof ArrayBuffer) ||
    !credential.response ||
    typeof credential.getClientExtensionResults !== 'function'
  ) {
    throw new Error('Privy did not receive a valid browser passkey credential');
  }
  return credential;
}

export function toAuthenticationResponse(credential: PasskeyCredentialLike): RecordLike {
  const response = credential.response;
  if (
    !(response.authenticatorData instanceof ArrayBuffer) ||
    !(response.signature instanceof ArrayBuffer)
  ) {
    throw new Error('Privy passkey authentication response is incomplete');
  }
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      authenticatorData: bytesToBase64Url(response.authenticatorData),
      signature: bytesToBase64Url(response.signature),
      userHandle: response.userHandle ? bytesToBase64Url(response.userHandle) : null,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

export function toRegistrationResponse(credential: PasskeyCredentialLike): RecordLike {
  const response = credential.response;
  if (!(response.attestationObject instanceof ArrayBuffer)) {
    throw new Error('Privy passkey registration response is incomplete');
  }
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      attestationObject: bytesToBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

export function passkeyChallenge(value: unknown): string {
  const response = asRecord(value);
  const options = asRecord(response?.options);
  if (!options || !isNonEmptyString(options.challenge)) {
    throw new Error('Privy passkey response did not include a challenge');
  }
  return options.challenge;
}

export function passkeyRelyingParty(value: unknown): string | undefined {
  const response = asRecord(value);
  return isNonEmptyString(response?.relying_party) ? response.relying_party : undefined;
}

export function passkeyAuthenticationOptions(value: unknown): PublicKeyCredentialRequestOptions {
  const response = asRecord(value);
  const options = asRecord(response?.options);
  if (!options || !isNonEmptyString(options.challenge)) {
    throw new Error('Privy passkey response did not include authentication options');
  }
  const allowCredentials = passkeyCredentialDescriptors(options.allow_credentials);
  const extensions = passkeyExtensions(options.extensions);
  return {
    challenge: base64UrlToBytes(options.challenge) as unknown as ArrayBuffer,
    ...(isNonEmptyString(options.rp_id) ? { rpId: options.rp_id } : {}),
    ...(allowCredentials ? { allowCredentials } : {}),
    ...(typeof options.timeout === 'number' ? { timeout: options.timeout } : {}),
    ...(isNonEmptyString(options.user_verification)
      ? { userVerification: options.user_verification as UserVerificationRequirement }
      : {}),
    ...(extensions ? { extensions } : {}),
  };
}

export function passkeyRegistrationOptions(value: unknown): PublicKeyCredentialCreationOptions {
  const response = asRecord(value);
  const options = asRecord(response?.options);
  const relyingParty = asRecord(options?.rp);
  const user = asRecord(options?.user);
  if (
    !options ||
    !isNonEmptyString(options.challenge) ||
    !relyingParty ||
    !isNonEmptyString(relyingParty.name) ||
    !user ||
    !isNonEmptyString(user.id) ||
    !isNonEmptyString(user.name) ||
    !isNonEmptyString(user.display_name)
  ) {
    throw new Error('Privy passkey response did not include registration options');
  }
  const pubKeyCredParams = Array.isArray(options.pub_key_cred_params)
    ? options.pub_key_cred_params.flatMap((entry) => {
        const parameter = asRecord(entry);
        return typeof parameter?.alg === 'number'
          ? [{ type: 'public-key' as const, alg: parameter.alg }]
          : [];
      })
    : [];
  if (pubKeyCredParams.length === 0) {
    throw new Error('Privy passkey response did not include algorithms');
  }
  const excludeCredentials = passkeyCredentialDescriptors(options.exclude_credentials);
  const extensions = passkeyExtensions(options.extensions);
  const selection = asRecord(options.authenticator_selection);
  return {
    challenge: base64UrlToBytes(options.challenge) as unknown as ArrayBuffer,
    rp: {
      name: relyingParty.name,
      ...(isNonEmptyString(relyingParty.id) ? { id: relyingParty.id } : {}),
    },
    user: {
      id: base64UrlToBytes(user.id) as unknown as ArrayBuffer,
      name: user.name,
      displayName: user.display_name,
    },
    pubKeyCredParams,
    ...(typeof options.timeout === 'number' ? { timeout: options.timeout } : {}),
    ...(isNonEmptyString(options.attestation)
      ? { attestation: options.attestation as AttestationConveyancePreference }
      : {}),
    ...(selection
      ? {
          authenticatorSelection: {
            ...(isNonEmptyString(selection.authenticator_attachment)
              ? {
                  authenticatorAttachment:
                    selection.authenticator_attachment as AuthenticatorAttachment,
                }
              : {}),
            ...(typeof selection.require_resident_key === 'boolean'
              ? { requireResidentKey: selection.require_resident_key }
              : {}),
            ...(isNonEmptyString(selection.resident_key)
              ? { residentKey: selection.resident_key as ResidentKeyRequirement }
              : {}),
            ...(isNonEmptyString(selection.user_verification)
              ? { userVerification: selection.user_verification as UserVerificationRequirement }
              : {}),
          },
        }
      : {}),
    ...(excludeCredentials ? { excludeCredentials } : {}),
    ...(extensions ? { extensions } : {}),
  };
}
