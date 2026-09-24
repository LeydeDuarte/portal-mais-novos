import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Termos de uso e Política de privacidade',
  description: 'Como a Mais Novos Imóveis usa seus dados ao entrar com o Google, salvar favoritos e falar com nossos corretores.'
};

// Texto-base — revisar com o jurídico antes de considerar definitivo.
export default function TermosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-5 py-10 text-[15px] leading-relaxed md:px-8">
        <h1 className="font-serif text-3xl font-semibold">Termos de uso e Política de privacidade</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Mais Novos Inteligência Imobiliária — CRECI C17586 · Goiânia, GO</p>

        <h2 className="mt-8 text-lg font-bold">1. Sobre o portal</h2>
        <p className="mt-2">
          O portal Mais Novos Imóveis divulga imóveis à venda e para alugar, lançamentos e condomínios. As informações dos anúncios (valores, metragens,
          disponibilidade e datas de entrega) podem mudar sem aviso e devem ser confirmadas com um de nossos corretores antes de qualquer negociação.
        </p>

        <h2 className="mt-6 text-lg font-bold">2. Login com Google</h2>
        <p className="mt-2">
          Ao entrar com sua conta Google, recebemos seu nome, e-mail e foto de perfil. Usamos esses dados para criar sua conta, guardar seus imóveis
          favoritos e personalizar as sugestões do site. Não recebemos nem armazenamos sua senha.
        </p>

        <h2 className="mt-6 text-lg font-bold">3. Contato e marketing</h2>
        <p className="mt-2">
          Se você marcar a opção de receber oportunidades, poderemos enviar por e-mail e WhatsApp novidades de imóveis, lançamentos e condições de
          financiamento. Você pode cancelar a qualquer momento, respondendo a qualquer mensagem ou falando com nosso atendimento. Quando você envia um
          formulário (Fale conosco, Registre seu interesse), usamos seus dados para responder ao seu pedido.
        </p>

        <h2 className="mt-6 text-lg font-bold">4. Compartilhamento</h2>
        <p className="mt-2">
          Não vendemos seus dados. Eles podem ser compartilhados apenas com os corretores da nossa equipe e, quando você pedir, com incorporadoras ou
          instituições financeiras envolvidas na negociação ou no financiamento do imóvel.
        </p>

        <h2 className="mt-6 text-lg font-bold">5. Seus direitos (LGPD)</h2>
        <p className="mt-2">
          Você pode pedir acesso, correção ou exclusão dos seus dados, e revogar o consentimento de marketing, a qualquer momento pelos nossos canais
          de atendimento. Guardamos os dados enquanto sua conta estiver ativa ou pelo tempo exigido por lei.
        </p>

        <h2 className="mt-6 text-lg font-bold">6. Anúncios reservados</h2>
        <p className="mt-2">
          Alguns imóveis do nosso portfólio não têm autorização do proprietário para publicação aberta. Nesses casos exibimos apenas as características
          gerais, e o anúncio completo é enviado individualmente a quem solicitar.
        </p>
      </main>
      <Footer />
    </div>
  );
}
