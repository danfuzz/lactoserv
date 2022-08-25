// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

export * from '#x/RedirectApplication';
export * from '#x/StaticApplication';
export * from '#x/Warehouse';

// Register all the built-in application types.
import { ApplicationFactory } from '#p/ApplicationFactory';
import { RedirectApplication } from '#x/RedirectApplication';
import { StaticApplication } from '#x/StaticApplication';
ApplicationFactory.register(StaticApplication);
ApplicationFactory.register(RedirectApplication);
