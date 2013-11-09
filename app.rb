require 'bundler/setup'

require 'sinatra'

class App < Sinatra::Base

  set :db_name, 'emberfire-ideavote'

  get '/' do
    erb :index, locals: { db_name: settings.db_name }
  end
end
