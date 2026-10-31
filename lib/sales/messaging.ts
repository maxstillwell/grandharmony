// Integration contract only. No provider credentials or customer sends are created by Sales Management.
export interface ExternalSalesNotifier {
  send(input: {
    projectId: string;
    recipientId: string;
    channel: 'email' | 'sms';
    consentEvidence: string;
    templateId: string;
    variables: Record<string, string>;
  }): Promise<{ providerReference: string }>;
}
export const externalMessagingStatus = {
  enabled: false,
  reason: 'No verified customer messaging provider is configured. In-app tasks remain available.',
} as const;
