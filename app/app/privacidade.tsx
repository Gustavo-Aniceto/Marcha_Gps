import React from 'react';
import { LegalPage } from '../src/components/LegalPage';
import { PRIVACY } from '../src/lib/legal';

export default function Privacidade() {
  return <LegalPage title="Política de privacidade" sections={PRIVACY} other={{ label: 'Termos de uso', href: '/termos' }} />;
}
