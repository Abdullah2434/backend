export interface UserVideoSettingsData {
  prompt: string;
  avatar: string[];
  titleAvatar: string;
  conclusionAvatar: string;
  name: string;
  position: string;
  companyName: string;
  license: string;
  tailoredFit: string;
  socialHandles: string;
  city: string;
  preferredTone: string;
  callToAction: string;
  email: string;
}

export interface UserVideoSettingsResponse {
  prompt: string;
  avatar: string[];
  titleAvatar: string;
  conclusionAvatar: string;
  name: string;
  position: string;
  companyName: string;
  license: string;
  tailoredFit: string;
  socialHandles: string;
  city: string;
  preferredTone: string;
  callToAction: string;
  email: string;
  updatedAt: Date;
}
