import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import MALWrapped from '../components/MALWrapped';

export default function Home() {
  return <MALWrapped />;
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
    revalidate: 60,
  };
}
