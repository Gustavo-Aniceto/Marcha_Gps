import React from 'react';
import { LegalPage } from '../src/components/LegalPage';
import { TERMS } from '../src/lib/legal';

export default function Termos() {
  return <LegalPage title="Termos de uso" sections={TERMS} other={{ label: 'Política de privacidade', href: '/privacidade' }} />;
}
