#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "pathname"

ROOT = Pathname.new(File.expand_path("..", __dir__))

def die(msg)
  warn "ERROR: #{msg}"
  exit 1
end

def warn_msg(msg)
  warn "WARN: #{msg}"
end

def ok_msg(msg)
  puts "OK: #{msg}"
end

def read_json(path)
  JSON.parse(File.read(path), symbolize_names: true)
rescue Errno::ENOENT
  die "File non trovato: #{path}"
rescue JSON::ParserError => e
  die "JSON non valido in #{path}: #{e.message}"
end

def expect(cond, msg)
  die msg unless cond
end

def expect_keys(obj, keys, ctx)
  keys.each do |k|
    expect(obj.key?(k), "#{ctx}: manca chiave obbligatoria '#{k}'")
  end
end

def expect_type(value, klass, ctx)
  expect(value.is_a?(klass), "#{ctx}: atteso #{klass}, trovato #{value.class}")
end

def slug?(s)
  !!(s =~ /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/)
end

def validate_conferenze(conferenze_path)
  conferenze = read_json(conferenze_path)
  expect_type(conferenze, Array, "#{conferenze_path}")

  ids = {}
  conferenze.each_with_index do |c, i|
    ctx = "#{conferenze_path}[#{i}]"
    expect_type(c, Hash, ctx)
    expect_keys(c, %i[id nome nome_breve area logo_url attiva], ctx)

    expect_type(c[:id], String, "#{ctx}.id")
    expect(slug?(c[:id]), "#{ctx}.id: deve essere lowercase, numeri e trattini (es. 'adriatic-b')")

    %i[nome nome_breve area logo_url].each do |k|
      expect_type(c[k], String, "#{ctx}.#{k}")
    end
    expect(c[:attiva] == true || c[:attiva] == false, "#{ctx}.attiva: deve essere boolean")

    if ids[c[:id]]
      die "#{ctx}.id duplicato: #{c[:id]}"
    end
    ids[c[:id]] = true
  end

  conferenze
end

def validate_giocanti(giocanti_path)
  giocanti = read_json(giocanti_path)
  expect_type(giocanti, Array, giocanti_path.to_s)

  ids = {}
  giocanti.each_with_index do |g, i|
    ctx = "#{giocanti_path}[#{i}]"
    expect_type(g, Hash, ctx)
    expect_keys(g, %i[id nome conferenza squadra foto_url iniziale colore_avatar motto], ctx)

    expect_type(g[:id], String, "#{ctx}.id")
    expect(slug?(g[:id]), "#{ctx}.id: deve essere slug (es. 'nick-lo-squartatore')")
    expect_type(g[:nome], String, "#{ctx}.nome")
    %i[conferenza squadra foto_url iniziale colore_avatar motto].each do |k|
      expect_type(g[k], String, "#{ctx}.#{k}")
    end

    if ids[g[:id]]
      die "#{ctx}.id duplicato: #{g[:id]}"
    end
    ids[g[:id]] = g
  end

  ids
end

def validate_classifica(classifica_path, giocanti_map)
  classifica = read_json(classifica_path)
  expect_type(classifica, Array, classifica_path.to_s)

  classifica.each_with_index do |r, i|
    ctx = "#{classifica_path}[#{i}]"
    expect_type(r, Hash, ctx)
    expect_keys(r, %i[posizione giocante_id sv punti partite_giocate partite_totali], ctx)

    expect_type(r[:posizione], Integer, "#{ctx}.posizione")
    expect_type(r[:giocante_id], String, "#{ctx}.giocante_id")
    %i[sv punti partite_giocate partite_totali].each do |k|
      expect_type(r[k], Integer, "#{ctx}.#{k}")
    end

    warn_msg "#{ctx}.giocante_id non trovato in giocanti.json: #{r[:giocante_id]}" unless giocanti_map.key?(r[:giocante_id])
  end

  classifica
end

VALID_STATI = %w[giocata da_giocare rinviata annullata].freeze

def validate_partite(partite_path, giocanti_map)
  partite = read_json(partite_path)
  expect_type(partite, Array, partite_path.to_s)

  seen_ids = {}
  pairs = {}

  partite.each_with_index do |m, i|
    ctx = "#{partite_path}[#{i}]"
    expect_type(m, Hash, ctx)
    expect_keys(
      m,
      %i[
        id giocante_a_id giocante_b_id
        set_a set_b
        punti_a_set_1 punti_b_set_1
        punti_a_set_2 punti_b_set_2
        stato
      ],
      ctx
    )

    expect_type(m[:id], String, "#{ctx}.id")
    die "#{ctx}.id duplicato: #{m[:id]}" if seen_ids[m[:id]]
    seen_ids[m[:id]] = true

    a = m[:giocante_a_id]
    b = m[:giocante_b_id]
    expect_type(a, String, "#{ctx}.giocante_a_id")
    expect_type(b, String, "#{ctx}.giocante_b_id")
    expect(a != b, "#{ctx}: giocante_a_id e giocante_b_id non possono coincidere")

    unless giocanti_map.key?(a)
      warn_msg "#{ctx}.giocante_a_id non trovato in giocanti.json: #{a}"
    end
    unless giocanti_map.key?(b)
      warn_msg "#{ctx}.giocante_b_id non trovato in giocanti.json: #{b}"
    end

    stato = m[:stato]
    expect_type(stato, String, "#{ctx}.stato")
    expect(VALID_STATI.include?(stato), "#{ctx}.stato: valore non valido (#{stato}), attesi: #{VALID_STATI.join(', ')}")

    if stato == "giocata"
      %i[set_a set_b punti_a_set_1 punti_b_set_1 punti_a_set_2 punti_b_set_2].each do |k|
        expect_type(m[k], Integer, "#{ctx}.#{k} (per stato=giocata)")
      end
    else
      %i[set_a set_b punti_a_set_1 punti_b_set_1 punti_a_set_2 punti_b_set_2].each do |k|
        expect(m[k].nil? || m[k].is_a?(Integer), "#{ctx}.#{k}: deve essere null o Integer")
      end
    end

    key = [a, b].sort.join("|")
    if pairs[key]
      warn_msg "#{ctx}: coppia duplicata (stessa sfida già presente): #{a} vs #{b}"
    end
    pairs[key] = true
  end

  partite
end

def expected_round_robin_count(n)
  n * (n - 1) / 2
end

year = ARGV[0] || "2026"
data_root = ROOT.join("assets/data/stagione-regolare", year)
expect(data_root.directory?, "Cartella anno mancante: #{data_root}")

conferenze_path = data_root.join("conferenze.json")
conferenze = validate_conferenze(conferenze_path)
attive = conferenze.select { |c| c[:attiva] }

ok_msg "Letto conferenze: #{conferenze.size} (attive: #{attive.size}) per anno #{year}"

errors = 0
warnings = 0

at_exit do
  # rubocop:disable Lint/UselessAssignment
  errors = errors
  warnings = warnings
  # rubocop:enable Lint/UselessAssignment
end

attive.each do |c|
  conf_id = c[:id]
  conf_dir = data_root.join(conf_id)
  unless conf_dir.directory?
    warn_msg "Conferenza '#{conf_id}' attiva ma cartella mancante: #{conf_dir}"
    next
  end

  giocanti_path = conf_dir.join("giocanti.json")
  classifica_path = conf_dir.join("classifica.json")
  partite_path = conf_dir.join("partite.json")

  unless giocanti_path.exist? && classifica_path.exist? && partite_path.exist?
    warn_msg "Conferenza '#{conf_id}': file mancanti (attesi giocanti/classifica/partite)"
    next
  end

  giocanti_map = validate_giocanti(giocanti_path)
  validate_classifica(classifica_path, giocanti_map)
  partite = validate_partite(partite_path, giocanti_map)

  n = giocanti_map.size
  expected = expected_round_robin_count(n)
  if partite.size != expected
    warn_msg "Conferenza '#{conf_id}': partite=#{partite.size}, attese=#{expected} per n=#{n} (formula n*(n-1)/2)"
  end

  ok_msg "Conferenza '#{conf_id}': giocanti=#{n}, partite=#{partite.size}"
end

ok_msg "Validazione completata."

